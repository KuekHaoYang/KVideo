import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore, type SortOption } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';

export function useHomePage() {
    useSubscriptionSync();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadFromCache, saveToCache } = useSearchCache();
    const hasLoadedCache = useRef(false);
    const hasSearchedWithSourcesRef = useRef(false);
    const isInitialCacheLoad = useRef(false);

    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [currentSortBy, setCurrentSortBy] = useState<SortOption>('default');

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/?q=${encodeURIComponent(q)}`, { scroll: false });
    }, [router]);

    // Search stream hook
    const {
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        performSearch,
        resetSearch,
        cancelSearch,
        loadCachedResults,
        applySorting,
        loadMore,
        hasMore,
        loadingMore,
    } = useParallelSearch(
        saveToCache,
        onUrlUpdate
    );

    // Core search execution function - extracted to eliminate duplication
    const executeSearch = useCallback((searchQuery: string) => {
        if (!searchQuery.trim()) return false;

        const settings = settingsStore.getSettings();
        const enabledSources = settings.sources.filter(s => s.enabled);

        // Merge user personal sources
        const userSources = userSourcesStore.getSources().filter(s => s.enabled !== false);
        const allSources = [...enabledSources];
        for (const us of userSources) {
            if (!allSources.find(s => s.id === us.id)) {
                allSources.push(us);
            }
        }

        if (allSources.length === 0) {
            return false;
        }

        performSearch(searchQuery, allSources, settings.sortBy);
        hasSearchedWithSourcesRef.current = true;
        return true;
    }, [performSearch]);

    // Re-sort results when sort preference changes
    useEffect(() => {
        // Skip re-sorting if this is a load from cache, to preserve the "remembered" position
        // Only re-sort if the user explicitly changes the sortBy option later
        if (hasSearched && results.length > 0 && !isInitialCacheLoad.current) {
            applySorting(currentSortBy);
        }
    }, [currentSortBy, applySorting, hasSearched, results.length]);

    // Load sort preference on mount and subscribe to changes
    useEffect(() => {
        const updateSettings = () => {
            const settings = settingsStore.getSettings();

            // Update sort preference
            if (settings.sortBy !== currentSortBy) {
                setCurrentSortBy(settings.sortBy);
            }

            // Check if we need to re-trigger search due to new sources being loaded
            // This fixes the issue where initial visit has 0 sources, then sources are loaded async
            // but the search (or lack thereof) is already stuck with empty sources.
            const enabledSources = settings.sources.filter(s => s.enabled);
            const hasSources = enabledSources.length > 0;

            // If we have a query, and we haven't searched with sources yet,
            // and we suddenly have sources, trigger the search.
            if (query && hasSources && !hasSearchedWithSourcesRef.current && !loading) {
                if (executeSearch(query)) {
                    setHasSearched(true);
                }
            }
        };

        // Initial load
        updateSettings();

        // Subscribe to changes
        const unsubscribe = settingsStore.subscribe(updateSettings);
        return () => unsubscribe();
    }, [query, loading, executeSearch, currentSortBy]);

    const handleSearch = useCallback((searchQuery: string) => {
        if (!searchQuery.trim()) return;

        // Clear scroll position for this search query to ensure we start at the top on a fresh search
        const scrollKey = `scroll-pos:/?q=${encodeURIComponent(searchQuery)}`;
        sessionStorage.removeItem(scrollKey);

        // Reset cache load flag for new search
        isInitialCacheLoad.current = false;

        setQuery(searchQuery);
        setHasSearched(true);
        executeSearch(searchQuery);
    }, [executeSearch]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');
        const cached = loadFromCache();

        if (urlQuery) {
            setQuery(urlQuery);
            if (cached && cached.query === urlQuery && cached.results.length > 0) {
                isInitialCacheLoad.current = true;
                setHasSearched(true);
                loadCachedResults(cached.results, cached.availableSources);
                hasSearchedWithSourcesRef.current = true;
            } else {
                handleSearch(urlQuery);
            }
        }
    }, [searchParams, loadFromCache, loadCachedResults, handleSearch]);



    const handleCancelSearch = useCallback(() => {
        cancelSearch();
    }, [cancelSearch]);

    const handleReset = useCallback(() => {
        setHasSearched(false);
        setQuery('');
        hasSearchedWithSourcesRef.current = false;
        resetSearch();
        router.replace('/', { scroll: false });
    }, [resetSearch, router]);

    return {
        query,
        hasSearched,
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        handleSearch,
        handleReset,
        handleCancelSearch,
        loadMore,
        hasMore,
        loadingMore,
    };
}
