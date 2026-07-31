import assert from 'node:assert/strict';
import test from 'node:test';

import {
  keepRenderableFavorites,
  keepRenderableHistory,
} from '@/lib/utils/sync-records';

const validIdentity = {
  videoId: 'video-1',
  source: 'source-a',
  title: 'Example',
};

test('sync record filters reject malformed identities', () => {
  assert.deepEqual(keepRenderableFavorites([
    validIdentity,
    { ...validIdentity, videoId: undefined },
    { ...validIdentity, videoId: Number.NaN },
    { ...validIdentity, source: '' },
    { ...validIdentity, title: '   ' },
    null,
  ]), [validIdentity]);
});

test('history records require a usable episode index', () => {
  const validHistory = { ...validIdentity, episodeIndex: 0 };

  assert.deepEqual(keepRenderableHistory([
    validHistory,
    { ...validIdentity },
    { ...validIdentity, episodeIndex: -1 },
    { ...validIdentity, episodeIndex: 1.5 },
    { ...validIdentity, episodeIndex: '0' },
  ]), [validHistory]);
});

test('sync record filters tolerate non-array payloads', () => {
  assert.deepEqual(keepRenderableHistory({ history: [] }), []);
  assert.deepEqual(keepRenderableFavorites(undefined), []);
});
