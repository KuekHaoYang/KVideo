import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { signSessionPayload } from '@/lib/server/auth-helpers';

process.env.AUTH_SECRET = 'route-test-secret';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

async function createSessionCookie(): Promise<string> {
  return signSessionPayload({
    accountId: 'account-1',
    profileId: 'profile-1',
    username: 'tester',
    name: 'Tester',
    role: 'admin',
    customPermissions: [],
    mode: 'managed',
    iat: Date.now(),
  }, process.env.AUTH_SECRET!);
}

async function makeAuthenticatedRequest(url: string, init?: RequestInit) {
  const sessionCookie = await createSessionCookie();
  const headers = new Headers(init?.headers);
  headers.set('cookie', `kvideo_session=${sessionCookie}`);

  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(url, {
    ...init,
    headers,
  });
}

test('user config routes silently no-op when Redis is unavailable', async () => {
  const configRoute = await import('../app/api/user/config/route');
  const readResponse = await configRoute.GET(
    await makeAuthenticatedRequest('https://kvideo.example/api/user/config'),
  );

  assert.equal(readResponse.status, 200);
  assert.deepEqual(await readResponse.json(), {
    success: true,
    data: null,
    synced: false,
  });

  const writeResponse = await configRoute.POST(
    await makeAuthenticatedRequest('https://kvideo.example/api/user/config', {
      method: 'POST',
      body: JSON.stringify({ locale: 'en-US' }),
    }),
  );

  assert.equal(writeResponse.status, 200);
  assert.deepEqual(await writeResponse.json(), {
    success: true,
    synced: false,
  });
});

test('user sync routes fall back to local-only responses when Redis is unavailable', async () => {
  const syncRoute = await import('../app/api/user/sync/route');
  const readResponse = await syncRoute.GET(
    await makeAuthenticatedRequest('https://kvideo.example/api/user/sync'),
  );

  assert.equal(readResponse.status, 200);
  assert.deepEqual(await readResponse.json(), {
    success: true,
    data: {
      history: [],
      favorites: [],
    },
    synced: false,
  });

  const writeResponse = await syncRoute.POST(
    await makeAuthenticatedRequest('https://kvideo.example/api/user/sync', {
      method: 'POST',
      body: JSON.stringify({
        history: [{ id: 'video-1' }],
        favorites: [{ id: 'video-2' }],
      }),
    }),
  );

  assert.equal(writeResponse.status, 200);
  assert.deepEqual(await writeResponse.json(), {
    success: true,
    synced: false,
  });
});
