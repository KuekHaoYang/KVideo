import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  clearAuthFailures,
  getAuthThrottleStatus,
  recordAuthFailure,
} from '@/lib/server/auth-rate-limit';

function makeRequest(ipAddress: string) {
  return new NextRequest('https://kvideo.example/api/auth', {
    headers: {
      'x-forwarded-for': ipAddress,
    },
  });
}

test('account throttling blocks repeated failures and clears after success', async () => {
  const request = makeRequest(`203.0.113.${Math.floor(Math.random() * 200) + 1}`);
  const username = `tester-${Date.now()}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordAuthFailure(request, username);
  }

  const blockedStatus = await getAuthThrottleStatus(request, username);
  assert.equal(blockedStatus.blocked, true);
  assert.ok(blockedStatus.retryAfterSeconds > 0);

  await clearAuthFailures(request, username);

  const clearedStatus = await getAuthThrottleStatus(request, username);
  assert.equal(clearedStatus.blocked, false);
});

test('ip throttling applies even without a username', async () => {
  const request = makeRequest(`198.51.100.${Math.floor(Math.random() * 200) + 1}`);

  const scope = `shared-ip-${Date.now()}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await recordAuthFailure(request, undefined, scope);
  }

  const throttled = await getAuthThrottleStatus(request, undefined, scope);
  assert.equal(throttled.blocked, true);
  assert.ok(throttled.retryAfterSeconds > 0);
});
