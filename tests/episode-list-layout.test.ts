import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeEpisodePagination,
  EPISODES_PER_PAGE,
  EPISODE_PAGINATION_THRESHOLD,
  type EpisodePagination,
} from '@/components/player/EpisodeList';

/**
 * Pin the multi-column grid + pagination behavior described in issue #218
 * (point 4): the EpisodeList must NOT paginate below the threshold even in
 * grid mode (preserves small-show usability), MUST paginate above it, and
 * MUST clamp the requested page to the available range.
 */

test('default constants match the issue #218 #4 spec', () => {
  assert.equal(EPISODES_PER_PAGE, 50);
  assert.equal(EPISODE_PAGINATION_THRESHOLD, 100);
});

test('list layout never paginates regardless of episode count', () => {
  const result: EpisodePagination = computeEpisodePagination(1234, 'list', 0);
  assert.equal(result.shouldPaginate, false);
  assert.equal(result.totalPages, 1);
  assert.equal(result.total, 1234);
  assert.equal(result.pageItems.length, 1234);
});

test('grid layout below the threshold renders flat with no pagination', () => {
  const below = EPISODE_PAGINATION_THRESHOLD;
  const result = computeEpisodePagination(below, 'grid', 0);
  assert.equal(result.shouldPaginate, false);
  assert.equal(result.totalPages, 1);
  assert.equal(result.pageItems.length, below);
  // 100 items at indices [0..99] flat — no slicing involved below threshold.
  assert.deepEqual(result.pageItems, Array.from({ length: below }, (_, i) => i));
});

test('grid layout at the threshold (boundary) does not paginate', () => {
  // 100 episodes at threshold is the documented cut-off: no pages.
  const result = computeEpisodePagination(EPISODE_PAGINATION_THRESHOLD, 'grid', 0);
  assert.equal(result.shouldPaginate, false);
  assert.equal(result.totalPages, 1);
});

test('grid layout above the threshold paginates and reports page buttons', () => {
  const total = EPISODE_PAGINATION_THRESHOLD + 1; // 101 → ceil(101/50) = 3 pages
  const pagination = computeEpisodePagination(total, 'grid', 0);
  assert.equal(pagination.shouldPaginate, true);
  assert.equal(pagination.totalPages, 3);
  // First page must show at most EPISODES_PER_PAGE items.
  assert.equal(pagination.pageItems.length, EPISODES_PER_PAGE);
  assert.equal(pagination.pageItems[0], 0);
  assert.equal(pagination.pageItems[EPISODES_PER_PAGE - 1], EPISODES_PER_PAGE - 1);
});

test('pagination reports one page button per page and the first page is bounded', () => {
  // 423 episodes → ceil(423/50) = 9 pages (50, 50, 50, 50, 50, 50, 50, 50, 23)
  const total = 423;
  const pagesSeen: number[] = [];
  for (let page = 0; page < 9; page++) {
    const result = computeEpisodePagination(total, 'grid', page);
    pagesSeen.push(result.totalPages);
    // Every page respects the page-size cap; last page may be shorter.
    assert.ok(
      result.pageItems.length <= EPISODES_PER_PAGE,
      `page ${page} has ${result.pageItems.length} items (> ${EPISODES_PER_PAGE})`,
    );
  }
  assert.deepEqual(pagesSeen, Array(9).fill(9));
});

test('requested page above range is clamped to the last page', () => {
  const total = EPISODE_PAGINATION_THRESHOLD + 250; // 350 episodes → 7 pages
  const overflow = computeEpisodePagination(total, 'grid', 999);
  const last = computeEpisodePagination(total, 'grid', 6);
  assert.deepEqual(overflow.pageItems, last.pageItems);
  assert.equal(overflow.totalPages, 7);
});

test('requested page below zero is clamped to zero', () => {
  const total = EPISODE_PAGINATION_THRESHOLD + 10;
  const negative = computeEpisodePagination(total, 'grid', -5);
  const first = computeEpisodePagination(total, 'grid', 0);
  assert.deepEqual(negative.pageItems, first.pageItems);
});

test('empty episode list yields empty page items but stable shape', () => {
  const result = computeEpisodePagination(0, 'grid', 0);
  assert.equal(result.shouldPaginate, false);
  assert.equal(result.total, 0);
  assert.equal(result.pageItems.length, 0);
  assert.equal(result.totalPages, 1);
});

test('non-integer and absurd inputs are sanitised', () => {
  // Negative threshold → clamped to 0, so any positive episode count paginates.
  // Page size 0 → clamped to 1, so each episode is its own page.
  const sanitised = computeEpisodePagination(150.9, 'grid', 5, 0, -10);
  assert.equal(sanitised.total, 150);
  assert.equal(sanitised.totalPages, 150); // 150 episodes × pageSize 1
  assert.equal(sanitised.pageItems.length, 1); // a single item per page
  assert.equal(sanitised.pageItems[0], 5); // requested page 5 → index 5
});

test('custom page size and threshold override the defaults for testing', () => {
  // 20 episodes, page size 10, threshold 5 → 20 > 5 ⇒ paginate into 2 pages of 10.
  const result = computeEpisodePagination(20, 'grid', 0, 10, 5);
  assert.equal(result.totalPages, 2);
  assert.equal(result.shouldPaginate, true);
  assert.equal(result.pageItems.length, 10);
});