import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type ListenerMap = Record<string, (event: Record<string, unknown>) => void>;

function toAbsoluteUrl(origin: string, input: RequestInfo | URL | string): string {
  if (typeof input === 'string') {
    return new URL(input, origin).toString();
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function createCacheStorage(origin: string) {
  const stores = new Map<string, Map<string, Response>>();

  function getStore(name: string) {
    let store = stores.get(name);
    if (!store) {
      store = new Map<string, Response>();
      stores.set(name, store);
    }
    return store;
  }

  async function matchAcrossCaches(input: RequestInfo | URL | string) {
    const absoluteUrl = toAbsoluteUrl(origin, input);
    for (const store of stores.values()) {
      const response = store.get(absoluteUrl);
      if (response) {
        return response.clone();
      }
    }
    return undefined;
  }

  return {
    caches: {
      async open(name: string) {
        const store = getStore(name);
        return {
          async addAll(urls: string[]) {
            for (const url of urls) {
              store.set(
                new URL(url, origin).toString(),
                new Response(`cached:${url}`, { status: 200 }),
              );
            }
          },
          async put(input: RequestInfo | URL | string, response: Response) {
            store.set(toAbsoluteUrl(origin, input), response.clone());
          },
          async match(input: RequestInfo | URL | string) {
            const response = store.get(toAbsoluteUrl(origin, input));
            return response?.clone();
          },
        };
      },
      async keys() {
        return [...stores.keys()];
      },
      async delete(name: string) {
        return stores.delete(name);
      },
      async match(input: RequestInfo | URL | string) {
        return matchAcrossCaches(input);
      },
    },
    stores,
  };
}

function createServiceWorkerHarness() {
  const origin = 'https://kvideo.example';
  const listeners: ListenerMap = {};
  const { caches, stores } = createCacheStorage(origin);
  let skipWaitingCalled = false;
  let clientsClaimed = false;
  let fetchImpl: typeof fetch = () => Promise.reject(new Error('fetch not stubbed'));

  const context = {
    URL,
    Request,
    Response,
    Promise,
    console,
    caches,
    fetch: (...args: Parameters<typeof fetch>) => fetchImpl(...args),
    self: {
      location: { origin },
      skipWaiting() {
        skipWaitingCalled = true;
        return Promise.resolve();
      },
      clients: {
        claim() {
          clientsClaimed = true;
          return Promise.resolve();
        },
      },
      addEventListener(type: string, listener: (event: Record<string, unknown>) => void) {
        listeners[type] = listener;
      },
    },
  };

  const scriptPath = path.join(process.cwd(), 'public', 'sw.js');
  const script = fs.readFileSync(scriptPath, 'utf8');
  vm.runInNewContext(script, context, { filename: scriptPath });

  return {
    listeners,
    stores,
    origin,
    caches,
    setFetchImpl(nextFetch: typeof fetch) {
      fetchImpl = nextFetch;
    },
    get skipWaitingCalled() {
      return skipWaitingCalled;
    },
    get clientsClaimed() {
      return clientsClaimed;
    },
  };
}

async function dispatchInstall(harness: ReturnType<typeof createServiceWorkerHarness>) {
  let installPromise: Promise<unknown> | undefined;
  harness.listeners.install({
    waitUntil(promise: Promise<unknown>) {
      installPromise = promise;
    },
  });
  await installPromise;
}

async function dispatchActivate(harness: ReturnType<typeof createServiceWorkerHarness>) {
  let activatePromise: Promise<unknown> | undefined;
  harness.listeners.activate({
    waitUntil(promise: Promise<unknown>) {
      activatePromise = promise;
    },
  });
  await activatePromise;
}

async function dispatchFetch(
  harness: ReturnType<typeof createServiceWorkerHarness>,
  request: { method: string; mode?: string; url: string },
) {
  let responsePromise: Promise<Response> | undefined;
  harness.listeners.fetch({
    request,
    respondWith(promise: Promise<Response>) {
      responsePromise = promise;
    },
  });

  return responsePromise;
}

test('service worker precaches the same-origin shell and clears legacy cache buckets', async () => {
  const harness = createServiceWorkerHarness();
  const legacyCache = await harness.caches.open('video-cache-old');
  await legacyCache.put('/legacy.js', new Response('legacy', { status: 200 }));

  await dispatchInstall(harness);
  await dispatchActivate(harness);

  const shellCache = harness.stores.get('kvideo-shell-v2');
  assert.ok(shellCache);
  assert.ok(shellCache?.has(`${harness.origin}/`));
  assert.ok(shellCache?.has(`${harness.origin}/offline.html`));
  assert.equal(harness.stores.has('video-cache-old'), false);
  assert.equal(harness.skipWaitingCalled, true);
  assert.equal(harness.clientsClaimed, true);
});

test('service worker falls back to cached shell for offline navigations and caches successful static assets', async () => {
  const harness = createServiceWorkerHarness();
  await dispatchInstall(harness);

  harness.setFetchImpl(async (input) => {
    const url = toAbsoluteUrl(harness.origin, input);
    if (url.endsWith('/app.js')) {
      return new Response('asset-body', { status: 200 });
    }

    throw new Error('offline');
  });

  const offlineNavigationResponsePromise = await dispatchFetch(
    harness,
    {
      method: 'GET',
      mode: 'navigate',
      url: `${harness.origin}/settings`,
    },
  );
  assert.ok(offlineNavigationResponsePromise);
  const offlineNavigationResponse = await offlineNavigationResponsePromise;
  assert.equal(await offlineNavigationResponse.text(), 'cached:/');

  const staticAssetResponsePromise = await dispatchFetch(
    harness,
    {
      method: 'GET',
      url: `${harness.origin}/app.js`,
    },
  );
  assert.ok(staticAssetResponsePromise);
  const staticAssetResponse = await staticAssetResponsePromise;
  assert.equal(await staticAssetResponse.text(), 'asset-body');

  await new Promise((resolve) => setTimeout(resolve, 0));
  const staticCache = harness.stores.get('kvideo-static-v2');
  assert.ok(staticCache?.has(`${harness.origin}/app.js`));
});
