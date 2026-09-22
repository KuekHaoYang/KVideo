/**
 * Source Browser helpers
 *
 * Pure utility functions used by the /sources page. Kept separate from the
 * React component so they can be unit-tested without rendering.
 */

import type { VideoSource } from '@/lib/types';

/**
 * Filter a list of video sources by a name query (case-insensitive).
 *
 * - Empty/whitespace-only query returns the original list (preserves order).
 * - Matches against `source.name`. Substring match; leading/trailing whitespace
 *   on either side is trimmed.
 * - Pure: never mutates the input.
 */
export function filterSourcesByName(
  sources: VideoSource[],
  query: string,
): VideoSource[] {
  const normalized = (query ?? '').trim().toLowerCase();
  if (!normalized) return sources.slice();

  return sources.filter((source) =>
    (source.name ?? '').toLowerCase().includes(normalized),
  );
}

/**
 * Build the home-page search URL that pre-loads a "热门" query and highlights
 * a specific source by name. The home page's search form picks up `q` via the
 * existing useSearchParams behavior; we pass the source name as a separate
 * hint parameter that the home page can read for highlighting (home page
 * already supports a `source=` hint on results).
 */
export function buildSourceSearchHref(sourceName: string): string {
  const params = new URLSearchParams();
  params.set('q', '热门');
  params.set('source', sourceName);
  return `/?${params.toString()}`;
}

/**
 * Friendly label for the source's "type" column.
 *
 * - `'premium'` -> '高级源'
 * - `'normal'` or unset -> '普通源'
 * - subscription sources (id starts with `subscription-`) -> '订阅源'
 */
export function describeSourceType(source: VideoSource): string {
  if (source.id && source.id.startsWith('subscription-')) return '订阅源';
  if (source.group === 'premium') return '高级源';
  return '普通源';
}
