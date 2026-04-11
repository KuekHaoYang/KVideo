import { useRef, useCallback } from 'react';
import { SOURCE_IDS } from '@/lib/utils/source-names';
import { sortVideos } from '@/lib/utils/sort';
import { binaryInsertVideos } from '@/lib/utils/sorted-insert';
import { processSearchStream } from '@/lib/utils/search-stream';
import type { SortOption } from '@/lib/store/settings-store';
import { settingsStore } from '@/lib/store/settings-store';
import type { Video } from '@/lib/types';
import { useSearchState } from './useSearchState';

type SearchState = ReturnType<typeof useSearchState>;

interface UseSearchActionProps {
    state: SearchState;
    onCacheUpdate: (query: string, results: any[], sources: any[]) => void;
    onUrlUpdate: (query: string) => void;
}

export function useSearchAction({ state, onCacheUpdate, onUrlUpdate }: UseSearchActionProps) {
    const {
        setLoading,
        setResults,
        setAvailableSources,
        setCompletedSources,
        setTotalSources,
        setTotalVideosFound,
        setCurrentPage,
        setMaxPageCount,
        setLoadingMore,
        currentPage,
        maxPageCount,
        startSearch,
    } = state;

    const abortControllerRef = useRef<AbortController | null>(null);
    // Keep track of the last search params so loadMore can re-use them
    const lastSearchParamsRef = useRef<{ query: string; sources: any[]; sortBy: SortOption } | null>(null);

    const performSearch = useCallback(async (searchQuery: string, sources: any[] = [], sortBy: SortOption = 'default') => {
        if (!searchQuery.trim()) return;

        // Resolve sources if not provided
        let targetSources = sources;
        if (!targetSources || targetSources.length === 0) {
            const settings = settingsStore.getSettings();
            targetSources = [
                ...settings.sources,
                ...settings.subscriptions.filter(s => (s as any).enabled !== false), // Include valid subscriptions
            ].filter(s => (s as any).enabled !== false);
        }

        // Abort any ongoing search
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Reset state
        startSearch(searchQuery.trim());

        // Save search params for loadMore
        lastSearchParamsRef.current = { query: searchQuery.trim(), sources: targetSources, sortBy };

        // Update URL
        onUrlUpdate(searchQuery);

        try {
            const response = await fetch('/api/search-parallel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, sources: targetSources, page: 1 }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error('Search failed');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const sourcesMap = new Map<string, { count: number; name: string }>();

            await processSearchStream({
                reader,
                currentQuery: searchQuery.trim(),
                onStart: (total) => setTotalSources(total),
                onVideos: (newVideos, sourceId) => {
                    // Optimized: Insert new videos in sorted position
                    setResults((prev) => binaryInsertVideos(prev, newVideos));

                    // Update source stats (accumulate across pages)
                    const existing = sourcesMap.get(sourceId);
                    if (existing) {
                        existing.count += newVideos.length;
                    } else {
                        sourcesMap.set(sourceId, {
                            count: newVideos.length,
                            name: newVideos[0]?.sourceName || sourceId,
                        });
                    }
                },
                onProgress: (completed, found) => {
                    setCompletedSources(completed);
                    setTotalVideosFound(found);
                },
                onPageInfo: (pageCount) => {
                    setMaxPageCount((prev) => Math.max(prev, pageCount));
                },
                onComplete: () => {
                    setLoading(false);

                    // Update available sources with correct property names
                    const sources = Array.from(sourcesMap.entries()).map(([id, info]) => ({
                        id: id,
                        name: info.name,
                        count: info.count,
                    }));
                    setAvailableSources(sources);

                    // Apply final sorting after all results are received
                    setResults((currentResults) => {
                        const sorted = sortVideos(currentResults, sortBy);

                        // Cache results
                        setTimeout(() => {
                            onCacheUpdate(searchQuery, sorted, sources);
                        }, 100);

                        return sorted;
                    });
                },
                onError: (message) => {
                    console.error('Search error:', message);
                    setLoading(false);
                },
            });

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Ignore abort errors and DO NOT set loading to false
                // because a new search might have already started
                return;
            } else {
                console.error('Search error:', error);
            }
            setLoading(false);
        }
    }, [startSearch, onUrlUpdate, onCacheUpdate, setTotalSources, setResults, setCompletedSources, setTotalVideosFound, setLoading, setAvailableSources, setMaxPageCount]);

    const loadMore = useCallback(async () => {
        const params = lastSearchParamsRef.current;
        if (!params) return;

        const nextPage = currentPage + 1;
        if (nextPage > maxPageCount) return;

        // Abort any ongoing load-more (but not the main search)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoadingMore(true);

        try {
            const response = await fetch('/api/search-parallel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: params.query, sources: params.sources, page: nextPage }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error('Load more failed');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            await processSearchStream({
                reader,
                currentQuery: params.query,
                onStart: () => { },
                onVideos: (newVideos) => {
                    // Append new videos to existing results
                    setResults((prev) => binaryInsertVideos(prev, newVideos));
                },
                onProgress: (_, found) => {
                    setTotalVideosFound((prev) => prev + found);
                },
                onPageInfo: (pageCount) => {
                    setMaxPageCount((prev) => Math.max(prev, pageCount));
                },
                onComplete: () => {
                    setCurrentPage(nextPage);
                    setLoadingMore(false);
                },
                onError: (message) => {
                    console.error('Load more error:', message);
                    setLoadingMore(false);
                },
            });

        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Load more error:', error);
            setLoadingMore(false);
        }
    }, [currentPage, maxPageCount, setLoadingMore, setResults, setTotalVideosFound, setCurrentPage, setMaxPageCount]);

    const cancelSearch = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return { performSearch, loadMore, cancelSearch };
}
