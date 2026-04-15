import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSourceResolutionBadge,
  shouldExpandForCurrentSource,
} from '@/lib/player/source-list-utils';
import { shouldReuseCachedResolution } from '@/lib/player/resolution-cache';

test('shouldExpandForCurrentSource detects hidden active sources', () => {
  const sources = [
    { source: 's1' },
    { source: 's2' },
    { source: 's3' },
    { source: 's4' },
    { source: 's5' },
    { source: 's6' },
  ];

  assert.equal(shouldExpandForCurrentSource(sources, 's6', 5), true);
  assert.equal(shouldExpandForCurrentSource(sources, 's3', 5), false);
});

test('getSourceResolutionBadge prefers current actual resolution, then probed, then cached, then remarks', () => {
  const current = getSourceResolutionBadge({
    isCurrent: true,
    currentResolution: { label: '1080P', color: 'bg-green-500' },
    probedResolution: { label: '720P', color: 'bg-teal-500' },
    cachedResolution: { label: '4K', color: 'bg-amber-500' },
    remarks: '蓝光',
  });
  assert.deepEqual(current, { label: '1080P', color: 'bg-green-500' });

  const probed = getSourceResolutionBadge({
    isCurrent: false,
    probedResolution: { label: '720P', color: 'bg-teal-500' },
    cachedResolution: { label: '4K', color: 'bg-amber-500' },
    remarks: '蓝光',
  });
  assert.deepEqual(probed, { label: '720P', color: 'bg-teal-500' });

  const cached = getSourceResolutionBadge({
    isCurrent: false,
    cachedResolution: { label: '4K', color: 'bg-amber-500' },
    remarks: '蓝光',
  });
  assert.deepEqual(cached, { label: '4K', color: 'bg-amber-500' });

  const remark = getSourceResolutionBadge({
    isCurrent: false,
    remarks: '蓝光原盘',
  });
  assert.deepEqual(remark, { label: '蓝光', color: 'bg-blue-500' });
});

test('shouldReuseCachedResolution keeps played results across episode changes but re-probes stale probed data', () => {
  assert.equal(shouldReuseCachedResolution({
    width: 1920,
    height: 1080,
    label: '1080P',
    color: 'bg-green-500',
    origin: 'played',
    episodeIndex: 0,
  }, 3), true);

  assert.equal(shouldReuseCachedResolution({
    width: 1920,
    height: 1080,
    label: '1080P',
    color: 'bg-green-500',
    origin: 'probed',
    episodeIndex: 2,
  }, 2), true);

  assert.equal(shouldReuseCachedResolution({
    width: 1920,
    height: 1080,
    label: '1080P',
    color: 'bg-green-500',
    origin: 'probed',
    episodeIndex: 2,
  }, 5), false);
});
