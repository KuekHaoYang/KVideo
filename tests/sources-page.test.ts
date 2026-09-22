import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();

// ---------------------------------------------------------------------------
// Pure helper: filterSourcesByName
// ---------------------------------------------------------------------------

test('filterSourcesByName returns the full list when query is empty', async () => {
  const { filterSourcesByName } = await import('@/lib/utils/source-browser');
  const sources = [
    { id: 'a', name: '源 A', baseUrl: 'https://a.example', searchPath: '/s', detailPath: '/d' },
    { id: 'b', name: '源 B', baseUrl: 'https://b.example', searchPath: '/s', detailPath: '/d' },
  ];
  assert.deepEqual(filterSourcesByName(sources, ''), sources);
  assert.deepEqual(filterSourcesByName(sources, '   '), sources);
});

test('filterSourcesByName narrows the list when typing a matching fragment', async () => {
  const { filterSourcesByName } = await import('@/lib/utils/source-browser');
  const sources = [
    { id: 'apple', name: '苹果影院', baseUrl: 'https://apple.example', searchPath: '/s', detailPath: '/d' },
    { id: 'banana', name: '香蕉资源', baseUrl: 'https://banana.example', searchPath: '/s', detailPath: '/d' },
    { id: 'cherry', name: '樱桃视频', baseUrl: 'https://cherry.example', searchPath: '/s', detailPath: '/d' },
  ];
  const matched = filterSourcesByName(sources, '苹果');
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, 'apple');
});

test('filterSourcesByName match is case-insensitive and trims whitespace', async () => {
  const { filterSourcesByName } = await import('@/lib/utils/source-browser');
  const sources = [
    { id: 'a', name: 'Apple Movies', baseUrl: 'https://a', searchPath: '/s', detailPath: '/d' },
    { id: 'b', name: 'BANANA TV', baseUrl: 'https://b', searchPath: '/s', detailPath: '/d' },
  ];
  assert.equal(filterSourcesByName(sources, '  apple ').length, 1);
  assert.equal(filterSourcesByName(sources, 'BANANA').length, 1);
  assert.equal(filterSourcesByName(sources, 'apple movies').length, 1);
});

test('filterSourcesByName returns an empty array when nothing matches', async () => {
  const { filterSourcesByName } = await import('@/lib/utils/source-browser');
  const sources = [
    { id: 'a', name: '苹果影院', baseUrl: 'https://a', searchPath: '/s', detailPath: '/d' },
  ];
  assert.deepEqual(filterSourcesByName(sources, 'zzz'), []);
});

test('filterSourcesByName does not mutate the input array', async () => {
  const { filterSourcesByName } = await import('@/lib/utils/source-browser');
  const sources = [
    { id: 'a', name: '苹果影院', baseUrl: 'https://a', searchPath: '/s', detailPath: '/d' },
    { id: 'b', name: '香蕉资源', baseUrl: 'https://b', searchPath: '/s', detailPath: '/d' },
  ];
  const original = sources.slice();
  filterSourcesByName(sources, '苹果');
  assert.deepEqual(sources, original);
});

// ---------------------------------------------------------------------------
// buildSourceSearchHref
// ---------------------------------------------------------------------------

test('buildSourceSearchHref includes q=热门 and the source name', async () => {
  const { buildSourceSearchHref } = await import('@/lib/utils/source-browser');
  const href = buildSourceSearchHref('苹果影院');
  assert.match(href, /^\/\?/);
  assert.match(href, /q=%E7%83%AD%E9%97%A8/); // URL-encoded 热门
  assert.match(href, /source=/);
  assert.match(href, /source=%E8%8B%B9%E6%9E%9C%E5%BD%B1%E9%99%A2/); // URL-encoded 苹果影院
});

// ---------------------------------------------------------------------------
// describeSourceType
// ---------------------------------------------------------------------------

test('describeSourceType labels subscription, premium, and normal sources', async () => {
  const { describeSourceType } = await import('@/lib/utils/source-browser');
  assert.equal(
    describeSourceType({ id: 'subscription-xyz', name: 'x', baseUrl: 'u', searchPath: '/s', detailPath: '/d' }),
    '订阅源',
  );
  assert.equal(
    describeSourceType({ id: 'p', name: 'x', baseUrl: 'u', searchPath: '/s', detailPath: '/d', group: 'premium' }),
    '高级源',
  );
  assert.equal(
    describeSourceType({ id: 'n', name: 'x', baseUrl: 'u', searchPath: '/s', detailPath: '/d' }),
    '普通源',
  );
});

// ---------------------------------------------------------------------------
// Page integration: asserts the rendered page references our helpers,
// the configured source set, the filter input, and the 查看 link.
// ---------------------------------------------------------------------------

test('sources page renders the configured sources via the pure helper', () => {
  const page = readFileSync(join(projectRoot, 'app/sources/page.tsx'), 'utf8');

  assert.match(page, /data-testid="sources-page-title"/);
  assert.match(page, /源浏览/);

  // The filter must use the tested helper (not an ad-hoc .filter) so the
  // behaviour we verify above is the same behaviour the page uses.
  assert.match(page, /filterSourcesByName\(/);

  // Filter UI controls.
  assert.match(page, /data-testid="sources-filter-input"/);
  assert.match(page, /data-testid="sources-count"/);
  assert.match(page, /按源名称筛选/);
  assert.match(page, /data-testid="sources-list"/);
  assert.match(page, /data-testid="source-row"/);

  // Empty / no-match states.
  assert.match(page, /data-testid="sources-empty"/);
  assert.match(page, /data-testid="sources-no-match"/);

  // Refresh latency button + 未探测 fallback when latency is missing.
  assert.match(page, /data-testid="sources-refresh"/);
  assert.match(page, /未探测/);

  // Each row has a 查看 link built by the helper.
  assert.match(page, /buildSourceSearchHref\(/);
  assert.match(page, /data-testid="source-search-link"/);
  assert.match(page, />查看</);

  // Liquid Glass design tokens (must match other pages).
  assert.match(page, /var\(--glass-bg\)/);
  assert.match(page, /var\(--text-color\)/);
  assert.match(page, /var\(--glass-border\)/);

  // Responsive: mobile-only and desktop-typical Tailwind breakpoints used.
  assert.match(page, /sm:flex/);
  assert.match(page, /flex-col/);
});

test('navbar links to the new /sources page', () => {
  const navbar = readFileSync(join(projectRoot, 'components/layout/Navbar.tsx'), 'utf8');
  assert.match(navbar, /href="\/sources"/);
  assert.match(navbar, /源浏览/);
});
