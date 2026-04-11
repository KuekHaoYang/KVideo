/**
 * usePersonalizedRecommendations
 *
 * Fetches personalized content based on viewing history patterns.
 * Designed to integrate into the tag system — returns the same shape
 * as usePopularMovies (movies, loading, hasMore, prefetchRef, loadMoreRef).
 *
 * Features:
 * - Interleaves results from multiple recommendation queries into a single mixed feed
 * - Randomizes Douban API offsets so each page load shows different content
 * - Excludes already-watched titles
 * - Auto-infinite-scroll via useInfiniteScroll (no "load more" button)
 * - When current queries exhaust, regenerates with new random offsets for more content
 * - Caches results for 30 minutes
 * - hasHistory = true when viewingHistory.length >= 2
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useHistoryStore, usePremiumHistoryStore } from '@/lib/store/history-store';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import {
  generateRecommendations,
  getWatchedTitles,
  interleaveResults,
  type RecommendationQuery,
} from '@/lib/utils/recommendation-engine';

interface DoubanMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface InterleavedMovie extends DoubanMovie {
  sourceLabel: string;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const ITEMS_PER_PAGE = 18; // How many to fetch per query per page
const MAX_ROUNDS = 8; // Max times to regenerate queries before giving up

export function usePersonalizedRecommendations(isPremium = false) {
  const normalHistory = useHistoryStore();
  const premiumHistory = usePremiumHistoryStore();
  const { viewingHistory } = isPremium ? premiumHistory : normalHistory;

  const [movies, setMovies] = useState<InterleavedMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const queriesRef = useRef<RecommendationQuery[]>([]);
  const roundRef = useRef(0); // Track how many times we've regenerated queries
  const allSeenTitlesRef = useRef<Set<string>>(new Set()); // Global dedup across rounds
  const cacheRef = useRef<{
    key: string;
    movies: InterleavedMovie[];
    timestamp: number;
  } | null>(null);

  const hasHistory = viewingHistory.length >= 2;

  // Fetch a page of results from all queries
  const fetchPage = useCallback(async (
    queries: RecommendationQuery[],
    pageNum: number,
    watchedTitles: Set<string>,
  ): Promise<InterleavedMovie[]> => {
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const offset = query.pageStart + pageNum * ITEMS_PER_PAGE;
          const res = await fetch(
            `/api/douban/recommend?tag=${encodeURIComponent(query.tag)}&type=${query.type}&page_limit=${ITEMS_PER_PAGE}&page_start=${offset}`
          );
          if (!res.ok) return { label: query.label, movies: [] as DoubanMovie[] };
          const data = await res.json();
          const movies: DoubanMovie[] = (data.subjects || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            cover: s.cover,
            rate: s.rate,
            url: s.url,
          }));
          return { label: query.label, movies };
        } catch {
          return { label: query.label, movies: [] as DoubanMovie[] };
        }
      })
    );

    return interleaveResults(results, watchedTitles);
  }, []);

  // Initial load
  useEffect(() => {
    if (viewingHistory.length < 2) {
      setMovies([]);
      setHasMore(false);
      return;
    }

    const queries = generateRecommendations(viewingHistory);
    queriesRef.current = queries;
    roundRef.current = 0;
    allSeenTitlesRef.current = new Set();

    if (queries.length === 0) {
      setMovies([]);
      setHasMore(false);
      return;
    }

    // Cache key based on query tags (not pageStart, since that's randomized)
    const cacheKey = queries.map(q => `${q.tag}:${q.type}`).join('|');

    if (
      cacheRef.current &&
      cacheRef.current.key === cacheKey &&
      Date.now() - cacheRef.current.timestamp < CACHE_DURATION
    ) {
      setMovies(cacheRef.current.movies);
      // Rebuild seen titles from cache
      for (const m of cacheRef.current.movies) {
        allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
      }
      setHasMore(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPage(0);
    setHasMore(true);

    const watchedTitles = getWatchedTitles(viewingHistory);

    fetchPage(queries, 0, watchedTitles).then((interleaved) => {
      if (cancelled) return;
      setMovies(interleaved);
      for (const m of interleaved) {
        allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
      }
      // Always assume there's more — we can regenerate queries if this round exhausts
      setHasMore(interleaved.length > 0);
      cacheRef.current = {
        key: queries.map(q => `${q.tag}:${q.type}`).join('|'),
        movies: interleaved,
        timestamp: Date.now(),
      };
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [viewingHistory.length, fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more via infinite scroll
  const handleLoadMore = useCallback(async (nextPage: number) => {
    const queries = queriesRef.current;
    if (queries.length === 0 || loading) return;

    setLoading(true);
    const watchedTitles = getWatchedTitles(viewingHistory);

    try {
      const newMovies = await fetchPage(queries, nextPage, watchedTitles);

      // Deduplicate against all previously seen movies (across all rounds)
      const uniqueNew = newMovies.filter(
        m => !allSeenTitlesRef.current.has(m.title.toLowerCase().trim())
      );

      if (uniqueNew.length === 0) {
        // Current queries exhausted — regenerate with new random offsets
        if (roundRef.current < MAX_ROUNDS) {
          roundRef.current += 1;
          const freshQueries = generateRecommendations(viewingHistory);
          queriesRef.current = freshQueries;

          // Fetch page 0 with fresh random offsets
          const freshMovies = await fetchPage(freshQueries, 0, watchedTitles);
          const freshUnique = freshMovies.filter(
            m => !allSeenTitlesRef.current.has(m.title.toLowerCase().trim())
          );

          if (freshUnique.length > 0) {
            for (const m of freshUnique) {
              allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
            }
            setMovies((prev) => [...prev, ...freshUnique]);
            setPage(0); // Reset page for fresh queries
            if (cacheRef.current) {
              cacheRef.current.movies = [...cacheRef.current.movies, ...freshUnique];
            }
          } else {
            // Even fresh queries yielded nothing new — stop
            setHasMore(false);
          }
        } else {
          // Exceeded max rounds — stop
          setHasMore(false);
        }
      } else {
        for (const m of uniqueNew) {
          allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
        }
        setMovies((prev) => [...prev, ...uniqueNew]);
        setPage(nextPage);
        if (cacheRef.current) {
          cacheRef.current.movies = [...cacheRef.current.movies, ...uniqueNew];
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [loading, viewingHistory, fetchPage]);

  const { prefetchRef, loadMoreRef } = useInfiniteScroll({
    hasMore,
    loading,
    page,
    onLoadMore: handleLoadMore,
  });

  return { movies, loading, hasMore, hasHistory, prefetchRef, loadMoreRef };
}
