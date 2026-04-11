import type { DanmakuComment, DanmakuSearchResult, DanmakuEpisode } from '@/lib/types/danmaku';

/**
 * Parse danmu_api response into normalized DanmakuComment[]
 * Handles both /api/v2/comment/{id} format and raw arrays
 */
export function parseDanmakuResponse(data: any): DanmakuComment[] {
  // The danmu_api /api/v2/comment/{id} returns { count, comments: [...] }
  const comments = data?.comments || data?.data || (Array.isArray(data) ? data : []);

  return comments
    .map((c: any) => {
      // danmu_api format: { p: "time,type,color", m: "text" }
      // or normalized: { time, type, color, text }
      if (c.p && c.m) {
        const parts = c.p.split(',');
        const time = parseFloat(parts[0]) || 0;
        const typeNum = parseInt(parts[1]) || 1;
        const colorNum = parseInt(parts[2]);
        return {
          text: c.m,
          time,
          type: typeNum === 5 ? 'top' : typeNum === 4 ? 'bottom' : 'scroll',
          color: colorNum ? `#${colorNum.toString(16).padStart(6, '0')}` : undefined,
        } as DanmakuComment;
      }

      if (typeof c.text === 'string' && typeof c.time === 'number') {
        return {
          text: c.text,
          time: c.time,
          type: c.type || 'scroll',
          color: c.color,
        } as DanmakuComment;
      }

      return null;
    })
    .filter((c: DanmakuComment | null): c is DanmakuComment => c !== null)
    .sort((a: DanmakuComment, b: DanmakuComment) => a.time - b.time);
}

/**
 * Parse danmu_api search results into DanmakuSearchResult[]
 */
export function parseSearchResults(data: any): DanmakuSearchResult[] {
  const animes = data?.animes || data?.data || (Array.isArray(data) ? data : []);

  return animes.map((a: any) => ({
    animeId: a.animeId ?? a.id ?? '',
    animeTitle: a.animeTitle ?? a.title ?? '',
    episodes: (a.episodes || []).map((ep: any) => ({
      episodeId: ep.episodeId ?? ep.id ?? '',
      episodeTitle: ep.episodeTitle ?? ep.title ?? '',
    })),
  }));
}

// Chinese numeral map
const CHINESE_NUMS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
  '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
  '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
};

function extractNumber(str: string): number | null {
  // Try Arabic digits first
  const digitMatch = str.match(/(\d+)/);
  if (digitMatch) return parseInt(digitMatch[1]);

  // Try Chinese numerals
  for (const [cn, num] of Object.entries(CHINESE_NUMS)) {
    if (str.includes(cn)) return num;
  }

  return null;
}

/**
 * Match a local episode name to a danmaku episode list
 * Uses heuristics: digit extraction, Chinese numerals, fallback to index
 */
export function matchEpisode(
  episodes: DanmakuEpisode[],
  episodeName: string,
  episodeIndex?: number
): DanmakuEpisode | null {
  if (!episodes.length) return null;

  // Extract episode number from local name
  const localNum = extractNumber(episodeName);

  if (localNum !== null) {
    // Try exact number match
    for (const ep of episodes) {
      const epNum = extractNumber(ep.episodeTitle);
      if (epNum === localNum) return ep;
    }
  }

  // Try title substring match
  const normalized = episodeName.trim().toLowerCase();
  for (const ep of episodes) {
    if (ep.episodeTitle.trim().toLowerCase() === normalized) return ep;
  }

  // Fallback: use episode index
  if (episodeIndex !== undefined && episodeIndex >= 0 && episodeIndex < episodes.length) {
    return episodes[episodeIndex];
  }

  return episodes[0] || null;
}

/**
 * Find best title match from search results using string similarity
 */
export function fuzzyMatchTitle(
  results: DanmakuSearchResult[],
  title: string
): DanmakuSearchResult | null {
  if (!results.length) return null;

  const normalizedTitle = title.trim().toLowerCase();

  // Exact match
  const exact = results.find(
    r => r.animeTitle.trim().toLowerCase() === normalizedTitle
  );
  if (exact) return exact;

  // Contains match (title contains search or search contains title)
  const contains = results.find(
    r =>
      r.animeTitle.toLowerCase().includes(normalizedTitle) ||
      normalizedTitle.includes(r.animeTitle.toLowerCase())
  );
  if (contains) return contains;

  // Return first result as fallback
  return results[0];
}
