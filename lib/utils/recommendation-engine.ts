/**
 * Recommendation Engine
 * Analyzes viewing history to generate personalized content recommendations.
 *
 * How it works:
 * 1. ANALYSIS: Scans all history items, counts frequency of genres (type_name),
 *    actors (vod_actor), and regions (vod_area).
 * 2. QUERY GENERATION: Produces up to 5 recommendation queries ranked by relevance:
 *    - Top 2 genres by watch count (threshold: 1+)
 *    - Top 1-2 actors if they appear across 2+ different videos
 *    - Top region if 3+ videos are from that region
 * 3. RANDOMIZATION: Each query gets a random page_start offset (0-40) so the
 *    Douban API returns different results on each page load.
 * 4. INTERLEAVING: Results from all queries are round-robin interleaved with
 *    shuffled pick order per round — e.g. [B,A,C,A,C,B] instead of [A,B,C,A,B,C]
 * 5. DEDUPLICATION: Already-watched titles are filtered out, and duplicate movies
 *    across different queries are removed.
 * 6. PAGINATION: Supports page-based loading — each "page" fetches a new batch
 *    from all queries with incremented offsets.
 */

import type { VideoHistoryItem } from '@/lib/types';

export interface RecommendationQuery {
  label: string;
  tag: string;
  type: 'movie' | 'tv';
  /** Random offset for Douban API pagination to vary results */
  pageStart: number;
}

/**
 * Analyze viewing history and generate recommendation queries.
 * Returns up to 5 queries based on top genres, actors, and regions.
 */
export function generateRecommendations(
  history: VideoHistoryItem[]
): RecommendationQuery[] {
  if (history.length === 0) return [];

  const queries: RecommendationQuery[] = [];

  // Count genres
  const genreCounts = new Map<string, number>();
  // Count actors
  const actorCounts = new Map<string, number>();
  // Count regions
  const areaCounts = new Map<string, number>();

  for (const item of history) {
    if (item.type_name) {
      const genre = item.type_name.trim();
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }

    if (item.vod_actor) {
      const actors = item.vod_actor.split(/[,，/]/).map(s => s.trim()).filter(Boolean);
      for (const actor of actors.slice(0, 3)) {
        actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1);
      }
    }

    if (item.vod_area) {
      const area = item.vod_area.trim();
      if (area) {
        areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
      }
    }
  }

  // Top 2 genres
  const sortedGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  for (const [genre, count] of sortedGenres) {
    if (count >= 1) {
      const type = genre.includes('剧') || genre.includes('电视') ? 'tv' : 'movie';
      queries.push({
        label: `${genre}推荐`,
        tag: genre,
        type,
        pageStart: Math.floor(Math.random() * 40),
      });
    }
  }

  // Top 1-2 actors (if appears in 2+ videos)
  const sortedActors = [...actorCounts.entries()]
    .sort((a, b) => b[1] - a[1]);
  const actorsToAdd = sortedActors.filter(([, count]) => count >= 2).slice(0, 2);
  for (const [actor] of actorsToAdd) {
    queries.push({
      label: `${actor}的作品`,
      tag: actor,
      type: 'movie',
      pageStart: Math.floor(Math.random() * 20),
    });
  }

  // Top region (if 3+ videos)
  const sortedAreas = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1]);
  if (sortedAreas.length > 0 && sortedAreas[0][1] >= 3) {
    queries.push({
      label: `${sortedAreas[0][0]}热门`,
      tag: sortedAreas[0][0],
      type: 'movie',
      pageStart: Math.floor(Math.random() * 40),
    });
  }

  return queries.slice(0, 5);
}

/**
 * Collect titles the user has already watched for exclusion.
 */
export function getWatchedTitles(history: VideoHistoryItem[]): Set<string> {
  const titles = new Set<string>();
  for (const item of history) {
    if (item.title) {
      titles.add(item.title.toLowerCase().trim());
    }
  }
  return titles;
}

interface InterleavedMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
  /** Which recommendation query this came from */
  sourceLabel: string;
}

/**
 * Fisher-Yates shuffle for an array (in-place).
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Round-robin interleave movies from multiple query result arrays,
 * with shuffled pick order per round for better variety.
 * Removes duplicates (by title) and already-watched titles.
 *
 * Example with 3 sources [A1,A2,A3], [B1,B2], [C1]:
 * Round 0 (shuffled): → B1, A1, C1
 * Round 1 (shuffled): → A2, B2
 * Round 2 (shuffled): → A3
 */
export function interleaveResults(
  resultsByQuery: { label: string; movies: Array<{ id: string; title: string; cover: string; rate: string; url: string }> }[],
  watchedTitles: Set<string>
): InterleavedMovie[] {
  const interleaved: InterleavedMovie[] = [];
  const seenTitles = new Set<string>();

  // Find the max length across all result arrays
  const maxLen = Math.max(...resultsByQuery.map(r => r.movies.length), 0);
  const numQueries = resultsByQuery.length;

  for (let i = 0; i < maxLen; i++) {
    // Shuffle the pick order for this round
    const indices = Array.from({ length: numQueries }, (_, idx) => idx);
    shuffleArray(indices);

    for (const idx of indices) {
      const result = resultsByQuery[idx];
      if (i >= result.movies.length) continue;

      const movie = result.movies[i];
      const titleKey = movie.title.toLowerCase().trim();

      // Skip duplicates and already-watched
      if (seenTitles.has(titleKey)) continue;
      if (watchedTitles.has(titleKey)) continue;

      seenTitles.add(titleKey);
      interleaved.push({
        ...movie,
        sourceLabel: result.label,
      });
    }
  }

  return interleaved;
}
