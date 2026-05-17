import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceEndpointUrl,
  normalizeSourceConfig,
  normalizeSourceConfigList,
} from '@/lib/server/source-validation';

test('normalizeSourceConfig accepts safe public source definitions and sanitizes headers', async () => {
  const source = await normalizeSourceConfig({
    id: 'demo-source',
    name: 'Demo Source',
    baseUrl: 'https://1.1.1.1',
    searchPath: '/api/search?q={wd}',
    detailPath: '/api/detail?id={id}',
    headers: {
      Referer: 'https://1.1.1.1/app',
      Cookie: 'do-not-forward',
    },
    enabled: true,
    priority: 5,
  });

  assert.ok(source);
  assert.equal(source?.id, 'demo-source');
  assert.equal(source?.headers?.Referer, 'https://1.1.1.1/app');
  assert.equal(source?.headers?.Cookie, undefined);
  assert.equal(
    buildSourceEndpointUrl(source!.baseUrl, source!.searchPath || '/'),
    'https://1.1.1.1/api/search?q={wd}',
  );
});

test('normalizeSourceConfig rejects malformed source objects and unsafe absolute paths', async () => {
  const invalid = await normalizeSourceConfig({
    id: 'Bad Source',
    name: 'Bad Source',
    baseUrl: 'http://127.0.0.1',
    searchPath: 'https://evil.example/redirect',
  });

  assert.equal(invalid, null);

  const normalizedList = await normalizeSourceConfigList([
    {
      id: 'valid-source',
      name: 'Valid Source',
      baseUrl: 'https://1.1.1.1',
      searchPath: '/search',
      detailPath: '/detail',
    },
    {
      id: 'bad source',
      name: 'Bad Source',
      baseUrl: 'https://1.1.1.1',
      searchPath: 'https://evil.example',
    },
  ]);

  assert.equal(normalizedList.length, 1);
  assert.equal(normalizedList[0].id, 'valid-source');
});
