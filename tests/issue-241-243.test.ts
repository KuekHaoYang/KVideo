import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

test('issue 241 placeholder poster declares light and system-dark palettes', () => {
  const source = readFileSync(join(projectRoot, 'public/placeholder-poster.svg'), 'utf8');

  assert.match(source, /prefers-color-scheme:\s*dark/);
  assert.match(source, /\.poster-bg-start\s*\{\s*stop-color:\s*#1c1c1e/);
  assert.match(source, /\.poster-label\s*\{\s*fill:\s*#aeaeb2/);
});

test('issue 243 search cards render source-provided update remarks', () => {
  const videoCard = readFileSync(join(projectRoot, 'components/search/VideoCard.tsx'), 'utf8');
  const groupCard = readFileSync(join(projectRoot, 'components/search/VideoGroupCard.tsx'), 'utf8');

  assert.match(videoCard, /const displayRemarks = htmlToText\(video\.vod_remarks\)/);
  assert.match(videoCard, /title=\{displayRemarks\}/);
  assert.match(groupCard, /const displayRemarks = useMemo/);
  assert.match(groupCard, /title=\{displayRemarks\}/);
});
