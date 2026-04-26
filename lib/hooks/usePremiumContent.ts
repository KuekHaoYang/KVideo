import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import { settingsStore } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

interface PremiumVideo {
    vod_id: string | number;
    vod_name: string;
    vod_pic?: string;
    vod_remarks?: string;
    type_name?: string;
    source: string;
}

interface PremiumCategoryResponse {
    videos?: PremiumVideo[];
}

const PAGE_LIMIT = 20;

export function usePremiumContent(categoryValue: string) {
    const [videos, setVideos] = useState<PremiumVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    // Track source count to detect meaningful updates
    const sourceCountRef = useRef(0);

    const loadVideos = useCallback(async (pageNum: number, append = false) => {
        if (loading) return;

        setLoading(true);
        try {
            // Get sources from settings
            const settings = settingsStore.getSettings();
            const premiumSources: VideoSource[] = settings.premiumSources.filter((source) => source.enabled !== false);

            if (premiumSources.length === 0) {
                setLoading(false);
                return;
            }

            // Should we include normal subscriptions too if categoryValue requests them?
            // The API handles filtering by categoryValue map.
            // If categoryValue is empty (Recommend), we use all enabled premium sources.

            const response = await fetch('/api/premium/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sources: premiumSources,
                    category: categoryValue,
                    page: pageNum.toString(),
                    limit: PAGE_LIMIT.toString()
                })
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const data = (await response.json()) as PremiumCategoryResponse;
            const newVideos = data.videos || [];

            setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
            setHasMore(newVideos.length === PAGE_LIMIT);
        } catch (error) {
            console.error('Failed to load videos:', error);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [loading, categoryValue]);

    // Initial load and category change
    useEffect(() => {
        setPage(1);
        setVideos([]);
        setHasMore(true);

        // Initial check for sources
        const settings = settingsStore.getSettings();
        const sourcesCount = settings.premiumSources.length;
        sourceCountRef.current = sourcesCount;

        loadVideos(1, false);
    }, [categoryValue]); // eslint-disable-line react-hooks/exhaustive-deps

    // Subscribe to settings changes to handle async source loading
    useEffect(() => {
        const handleSettingsUpdate = () => {
            const settings = settingsStore.getSettings();
            const premiumSources = settings.premiumSources.filter((source) => source.enabled !== false);

            const currentSourceCount = premiumSources.length;

            // If we have 0 videos and suddenly gain sources, we should retry loading
            // OR if the number of sources significantly changed (e.g. from 0 to N)
            if (videos.length === 0 && currentSourceCount > 0 && !loading) {
                // Determine if we should reload. 
                // Mostly needed when initial load failed due to no sources.
                loadVideos(1, false);
            }
        };

        const unsubscribe = settingsStore.subscribe(handleSettingsUpdate);
        return () => unsubscribe();
    }, [loadVideos, videos.length, loading]);

    const { prefetchRef, loadMoreRef } = useInfiniteScroll({
        hasMore,
        loading,
        page,
        onLoadMore: (nextPage) => {
            setPage(nextPage);
            loadVideos(nextPage, true);
        },
    });

    return {
        videos,
        loading,
        hasMore,
        prefetchRef,
        loadMoreRef,
    };
}
