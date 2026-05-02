import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config';

test('next image config allows proxied Douban image URLs with query strings', () => {
  const localPatterns = nextConfig.images?.localPatterns || [];

  assert.ok(
    localPatterns.some((pattern) => pattern.pathname === '/api/douban/image' && !('search' in pattern)),
  );
});
