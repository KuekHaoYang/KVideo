'use client';

import { useCallback } from 'react';
import { sortVideos } from '@/lib/utils/sort';
import type { SortOption } from '@/lib/store/settings-store';
import type { Video, SourceBadge, VideoSource } from '@/lib/types';
import { useSearchState } from './useSearchState';
import { useSearchAction } from './useSearchAction';

interface ParallelSearchResult {
  loading: boolean;
  results: Video[];
  availableSources: SourceBadge[];
  completedSources: number;
  totalSources: number;
  totalVideosFound: number;
  performSearch: (query: string, sources?: VideoSource[], sortBy?: SortOption) => Promise<void>;
  resetSearch: () => void;
  cancelSearch: () => void;
  loadCachedResults: (results: Video[], sources: SourceBadge[]) => void;
  applySorting: (sortBy: SortOption) => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
}

export function useParallelSearch(
  onCacheUpdate: (query: string, results: Video[], sources: SourceBadge[]) => void,
  onUrlUpdate: (query: string) => void
): ParallelSearchResult {
  const state = useSearchState();
  const {
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    totalVideosFound,
    currentPage,
    maxPageCount,
    loadingMore,
    setResults,
    setAvailableSources,
    setTotalVideosFound,
    resetState,
  } = state;

  const { performSearch, loadMore: loadMoreAction, cancelSearch } = useSearchAction({
    state,
    onCacheUpdate,
    onUrlUpdate,
  });

  const hasMore = currentPage < maxPageCount;

  /**
   * Reset search state
   */
  const resetSearch = useCallback(() => {
    cancelSearch();
    resetState();
  }, [cancelSearch, resetState]);

  /**
   * Load cached results
   */
  const loadCachedResults = useCallback((cachedResults: Video[], cachedSources: SourceBadge[]) => {
    setResults(cachedResults);
    setAvailableSources(cachedSources);
    setTotalVideosFound(cachedResults.length);
  }, [setResults, setAvailableSources, setTotalVideosFound]);

  /**
   * Apply sorting to current results
   */
  const applySorting = useCallback((sortBy: SortOption) => {
    setResults((currentResults) => sortVideos(currentResults, sortBy));
  }, [setResults]);

  return {
    loading,
    results,
    availableSources,
    completedSources,
    totalSources,
    totalVideosFound,
    performSearch,
    resetSearch,
    cancelSearch,
    loadCachedResults,
    applySorting,
    loadMore: loadMoreAction,
    hasMore,
    loadingMore,
  };
}
