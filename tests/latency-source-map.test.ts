import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLatencySourceUrls } from '@/lib/utils/latency-source-map';

test('buildLatencySourceUrls maps visible source ids back to their real configured base URLs', () => {
  const mapped = buildLatencySourceUrls(
    [
      { id: 'source-b' },
      { id: 'source-a' },
      { id: 'missing-source' },
    ],
    [
      { id: 'source-a', baseUrl: 'https://a.example.com' },
      { id: 'source-b', baseUrl: 'https://b.example.com' },
    ],
  );

  assert.deepEqual(mapped, [
    { id: 'source-b', baseUrl: 'https://b.example.com' },
    { id: 'source-a', baseUrl: 'https://a.example.com' },
  ]);
});
