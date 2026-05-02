import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvSources } from '@/lib/store/settings-store';

test('parseEnvSources accepts direct normal and premium source definitions', () => {
  const parsed = parseEnvSources(JSON.stringify({
    sources: [
      {
        id: 'Demo-Source',
        name: 'Demo Source',
        baseUrl: 'https://example.com/api.php/provide/vod',
        searchPath: '',
        detailPath: '',
        headers: {
          Referer: 'https://example.com',
          Invalid: 123,
        },
      },
      {
        id: 'premium-demo',
        name: 'Premium Demo',
        baseUrl: 'https://premium.example.com',
        group: 'premium',
      },
    ],
  }));

  assert.equal(parsed.normalSources.length, 1);
  assert.equal(parsed.normalSources[0].id, 'demo-source');
  assert.equal(parsed.normalSources[0].headers?.Referer, 'https://example.com');
  assert.equal(parsed.normalSources[0].headers?.Invalid, undefined);
  assert.equal(parsed.premiumSources.length, 1);
  assert.equal(parsed.premiumSources[0].id, 'premium-demo');
});

test('parseEnvSources rejects malformed JSON and malformed entries', () => {
  assert.deepEqual(parseEnvSources('not json'), {
    normalSources: [],
    premiumSources: [],
  });

  const parsed = parseEnvSources(JSON.stringify([
    { id: 'missing-base-url', name: 'Missing base URL' },
    { id: 'ok', name: 'OK', baseUrl: 'https://ok.example.com' },
  ]));

  assert.equal(parsed.normalSources.length, 1);
  assert.equal(parsed.normalSources[0].id, 'ok');
});
