import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractResolutionHint,
  extractVariantPlaylistUrls,
  parseResolutionFromManifest,
} from '@/lib/player/resolution-probe-utils';

test('extractResolutionHint recognizes resolution hints from URLs and remarks', () => {
  assert.deepEqual(
    extractResolutionHint('https://cdn.example.com/show/2160/index.m3u8'),
    { label: '4K', color: 'bg-amber-500', width: 3840, height: 2160 }
  );

  assert.deepEqual(
    extractResolutionHint('片源 1280x720'),
    { label: '720P', color: 'bg-teal-500', width: 1280, height: 720 }
  );

  assert.equal(extractResolutionHint('蓝光原盘'), null);
});

test('parseResolutionFromManifest prefers the highest explicit resolution', () => {
  const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4800000,RESOLUTION=1280x720,NAME="720P"
mid/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=9200000,RESOLUTION=1920x1080,NAME="1080P"
high/index.m3u8
`;

  assert.deepEqual(
    parseResolutionFromManifest(manifest, 'https://media.example.com/master.m3u8'),
    { label: '1080P', color: 'bg-green-500', width: 1920, height: 1080 }
  );
});

test('parseResolutionFromManifest falls back to variant URL hints when RESOLUTION is missing', () => {
  const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=9200000,NAME="Ultra"
./video_4k/index.m3u8
`;

  assert.deepEqual(
    parseResolutionFromManifest(manifest, 'https://media.example.com/master.m3u8'),
    { label: '4K', color: 'bg-amber-500', width: 3840, height: 2160 }
  );
});

test('extractVariantPlaylistUrls resolves stream and iframe variant URLs', () => {
  const manifest = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=9200000,NAME="1080P"
./video_1080/index.m3u8
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=200000,URI="./iframes/720p.m3u8"
`;

  assert.deepEqual(
    extractVariantPlaylistUrls(manifest, 'https://media.example.com/master.m3u8'),
    [
      'https://media.example.com/video_1080/index.m3u8',
      'https://media.example.com/iframes/720p.m3u8',
    ]
  );
});
