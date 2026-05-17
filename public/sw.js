const CACHE_VERSION = 'kvideo-shell-v2';
const STATIC_CACHE_VERSION = 'kvideo-static-v2';
const LEGACY_CACHE_PREFIXES = ['video-cache-', 'kvideo-shell-v1', 'kvideo-static-v1'];
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = ['/', OFFLINE_URL, '/manifest.json', '/icon.png', '/placeholder-poster.svg'];

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname === '/manifest.json' ||
    pathname === '/icon.png' ||
    pathname === '/placeholder-poster.svg' ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.svg')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_VERSION &&
                cacheName !== STATIC_CACHE_VERSION &&
                LEGACY_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request.url)) {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put('/', responseClone).catch(() => {});
          });
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/player') ||
    url.pathname.startsWith('/iptv')
  ) {
    return;
  }

  if (!isStaticAsset(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_VERSION).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    }),
  );
});
