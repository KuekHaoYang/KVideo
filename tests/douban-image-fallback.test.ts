import assert from 'node:assert/strict';
import test from 'node:test';

import { GET } from '@/app/api/douban/image/route';
import { buildDoubanImageCandidates } from '@/lib/server/douban-image';

test('Douban image candidates preserve the path and try reachable mirrors', () => {
  const candidates = buildDoubanImageCandidates(
    'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p123.webp?x=1',
  );

  assert.deepEqual(candidates, [
    'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p123.webp?x=1',
    'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p123.webp?x=1',
    'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p123.webp?x=1',
    'https://img2.doubanio.com/view/photo/s_ratio_poster/public/p123.webp?x=1',
  ]);
});

test('non-Douban and malformed URLs are attempted only once', () => {
  assert.deepEqual(buildDoubanImageCandidates('https://example.com/poster.jpg'), [
    'https://example.com/poster.jpg',
  ]);
  assert.deepEqual(buildDoubanImageCandidates('not a url'), ['not a url']);
});

test('image proxy falls back after a mirror network failure', async (context) => {
  const requested: string[] = [];

  context.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = input.toString();
    requested.push(url);

    if (url.includes('img1.doubanio.com')) {
      throw new TypeError('fetch failed');
    }

    return new Response('image-bytes', {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    });
  });

  const target = encodeURIComponent('https://img1.doubanio.com/poster.webp');
  const response = await GET(new Request(`https://kvideo.test/api/douban/image?url=${target}`));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(await response.text(), 'image-bytes');
  assert.deepEqual(requested, [
    'https://img1.doubanio.com/poster.webp',
    'https://img9.doubanio.com/poster.webp',
  ]);
});
