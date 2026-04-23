export interface ResolutionCacheEntry {
  width?: number;
  height?: number;
  label: string;
  color: string;
  origin?: 'probed' | 'played' | 'hint';
  episodeIndex?: number;
}

const CACHE_PREFIX = 'res:';

export function getResolutionCacheKey(source: string, id: string | number): string {
  return `${CACHE_PREFIX}${source}:${id}`;
}

export function getCachedResolution(source: string, id: string | number): ResolutionCacheEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(getResolutionCacheKey(source, id));
    if (!raw) return null;
    return JSON.parse(raw) as ResolutionCacheEntry;
  } catch {
    return null;
  }
}

export function setCachedResolution(
  source: string,
  id: string | number,
  info: ResolutionCacheEntry
): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(getResolutionCacheKey(source, id), JSON.stringify(info));
  } catch {
    // Ignore sessionStorage failures and keep the UI functional.
  }
}

export function shouldReuseCachedResolution(
  entry: ResolutionCacheEntry | null,
  episodeIndex?: number
): boolean {
  if (!entry) return false;
  if (entry.origin === 'played') return true;
  if (entry.origin === 'hint') return false;
  return entry.episodeIndex === episodeIndex;
}
