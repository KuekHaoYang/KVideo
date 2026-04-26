import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OutboundPolicyError,
  assertOutboundUrlAllowed,
  fetchWithPolicy,
  getRelayForwardHeaders,
  sanitizeHeaderMap,
  sanitizeReferer,
  sanitizeUserAgent,
} from '@/lib/server/outbound-policy';

test('assertOutboundUrlAllowed rejects non-http protocols and private IPs by default', async () => {
  await assert.rejects(
    assertOutboundUrlAllowed('ftp://example.com/video.m3u8'),
    (error: unknown) =>
      error instanceof OutboundPolicyError && error.code === 'UNSUPPORTED_OUTBOUND_PROTOCOL',
  );

  await assert.rejects(
    assertOutboundUrlAllowed('http://127.0.0.1/stream.m3u8'),
    (error: unknown) =>
      error instanceof OutboundPolicyError && error.code === 'PRIVATE_OUTBOUND_TARGET',
  );
});

test('assertOutboundUrlAllowed permits explicitly allowlisted private hosts', async () => {
  const previousAllowlist = process.env.KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST;
  process.env.KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST = '127.0.0.1,lan.example';

  try {
    const url = await assertOutboundUrlAllowed('http://127.0.0.1/live.m3u8');
    assert.equal(url.hostname, '127.0.0.1');
  } finally {
    process.env.KVIDEO_OUTBOUND_PRIVATE_HOST_ALLOWLIST = previousAllowlist;
  }
});

test('fetchWithPolicy blocks redirects into private ranges', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 302,
      headers: {
        location: 'http://127.0.0.1/private.m3u8',
      },
    })) as typeof fetch;

  try {
    await assert.rejects(
      fetchWithPolicy('https://1.1.1.1/public.m3u8'),
      (error: unknown) =>
        error instanceof OutboundPolicyError && error.code === 'PRIVATE_OUTBOUND_TARGET',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('relay header sanitizers keep the safe forwarding surface small', async () => {
  const sanitizedHeaders = sanitizeHeaderMap({
    Range: 'bytes=0-1024',
    Cookie: 'session=secret',
    Referer: 'https://1.1.1.1/watch',
    'X-Forwarded-For': '1.2.3.4',
  });

  assert.deepEqual(sanitizedHeaders, {
    Range: 'bytes=0-1024',
    Referer: 'https://1.1.1.1/watch',
  });

  const request = new Request('https://kvideo.example/api/proxy?url=https://1.1.1.1/test', {
    headers: {
      Range: 'bytes=100-200',
      Cookie: 'session=secret',
    },
  });

  const forwardHeaders = getRelayForwardHeaders(request, {
    Referer: 'https://1.1.1.1/watch',
    'User-Agent': sanitizeUserAgent('KVideo Test Agent'.repeat(40))!,
  });

  assert.equal(forwardHeaders.get('Range'), 'bytes=100-200');
  assert.equal(forwardHeaders.get('Cookie'), null);
  assert.equal(forwardHeaders.get('Referer'), 'https://1.1.1.1/watch');
  assert.ok((forwardHeaders.get('User-Agent') || '').length <= 512);

  assert.equal(await sanitizeReferer('https://1.1.1.1/watch'), 'https://1.1.1.1/watch');
});
