import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore } from '@/lib/store/settings-store';
import { VideoSource } from '@/lib/types';

export function usePremiumHomePage() {
    useSubscriptionSync();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loadFromCache, saveToCache } = useSearchCache();
    const hasLoadedCache = useRef(false);
    const hasSearchedWithSourcesRef = useRef(false);

    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [currentSortBy, setCurrentSortBy] = useState('default');

    // Use state for sources to trigger re-renders when they update
    const [enabledPremiumSources, setEnabledPremiumSources] = useState<VideoSource[]>([]);

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/premium?q=${encodeURIComponent(q)}`, { scroll: false });
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
    const executeSearch = useCallback((searchQuery: string, sources: VideoSource[]) => {
        if (!searchQuery.trim()) return false;

        if (sources.length === 0) {
            return false;
        }

        performSearch(searchQuery, sources, currentSortBy as any);
        hasSearchedWithSourcesRef.current = true;
        return true;
    }, [performSearch, currentSortBy]);

    // Re-sort results when sort preference changes
    useEffect(() => {
        if (hasSearched && results.length > 0) {
            applySorting(currentSortBy as any);
        }
    }, [currentSortBy, applySorting, hasSearched, results.length]);

    // Load sources and subscribe to changes
    useEffect(() => {
        const updateSettings = () => {
            const settings = settingsStore.getSettings();

            // Update sort preference if changed
            // Note: settings.sortBy might be shared or we might want specific one, 
            // but for now we follow the store or keep local state if we want independence.
            // The original hook had local state 'default'.

            const newPremiumSources = settings.premiumSources.filter(s => s.enabled);
            setEnabledPremiumSources(newPremiumSources);

            // Check if we need to re-trigger search due to new sources being loaded
            const hasSources = newPremiumSources.length > 0;

            // If we have a query, and we haven't searched with sources yet,
            // and we suddenly have sources, trigger the search.
            if (query && hasSources && !hasSearchedWithSourcesRef.current && !loading) {
                if (executeSearch(query, newPremiumSources)) {
                    setHasSearched(true);
                }
            }
        };

        // Initial load
        updateSettings();

        // Subscribe to changes
        const unsubscribe = settingsStore.subscribe(updateSettings);
        return () => unsubscribe();
    }, [query, loading, executeSearch]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');

        if (urlQuery) {
            setQuery(urlQuery);
            // We need to wait for sources to be available, which is handled by the subscription effect
            // But if sources are already available (e.g. navigation), execute immediately
            const currentSettings = settingsStore.getSettings();
            const currentSources = currentSettings.premiumSources.filter(s => s.enabled);

            if (currentSources.length > 0) {
                handleSearch(urlQuery);
            }
            // If no sources yet, the useEffect above will catch it when they load
        }
    }, [searchParams]);

    const handleSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        setHasSearched(true);
        // Use current state of sources
        executeSearch(searchQuery, enabledPremiumSources);
    };

    const handleReset = () => {
        setHasSearched(false);
        setQuery('');
        hasSearchedWithSourcesRef.current = false;
        resetSearch();
        router.replace('/premium', { scroll: false });
    };

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
        handleCancelSearch: cancelSearch,
        loadMore,
        hasMore,
        loadingMore,
    };
}
