import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const projectRoot = process.cwd();

test('issue 241 placeholder poster has a system dark-mode branch', () => {
  const source = readFileSync(join(projectRoot, 'public/placeholder-poster.svg'), 'utf8');

  assert.match(source, /prefers-color-scheme:\s*dark/);
  assert.match(source, /#1c1c1e/);
  assert.match(source, /#aeaeb2/);
});

test('issue 243 search cards keep update remarks visible', () => {
  const normalCard = readFileSync(join(projectRoot, 'components/search/VideoCard.tsx'), 'utf8');
  const groupedCard = readFileSync(join(projectRoot, 'components/search/VideoGroupCard.tsx'), 'utf8');

  assert.match(normalCard, /htmlToText\(video\.vod_remarks\)/);
  assert.match(normalCard, /\{displayRemarks && \(/);
  assert.match(groupedCard, /htmlToText\(preferredVideo\?\.vod_remarks\)/);
  assert.match(groupedCard, /\{displayRemarks && \(/);
});
