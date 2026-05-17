import { useState, useEffect, useCallback } from 'react';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';

interface HomeTag {
    id: string;
    label: string;
    value: string;
}

interface DoubanMovie {
    id: string;
    title: string;
    cover: string;
    rate: string;
    url: string;
}

interface DoubanRecommendResponse {
    subjects?: DoubanMovie[];
}

const PAGE_LIMIT = 20;

export function usePopularMovies(selectedTag: string, tags: HomeTag[], contentType: 'movie' | 'tv' = 'movie') {
    const [movies, setMovies] = useState<DoubanMovie[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    const loadMovies = useCallback(async (tag: string, pageStart: number, append = false) => {
        if (loading) return;

        setLoading(true);
        try {
            const tagValue = tags.find(t => t.id === tag)?.value || '热门';
            const response = await fetch(
                `/api/douban/recommend?type=${contentType}&tag=${encodeURIComponent(tagValue)}&page_limit=${PAGE_LIMIT}&page_start=${pageStart}`
            );

            if (!response.ok) throw new Error('Failed to fetch');

            const data = (await response.json()) as DoubanRecommendResponse;
            const newMovies = data.subjects || [];

            setMovies(prev => append ? [...prev, ...newMovies] : newMovies);
            setHasMore(newMovies.length === PAGE_LIMIT);
        } catch (error) {
            console.error('Failed to load movies:', error);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [loading, tags, contentType]);

    useEffect(() => {
        setPage(0);
        setMovies([]);
        setHasMore(true);
        loadMovies(selectedTag, 0, false);
    }, [selectedTag, contentType]); // eslint-disable-line react-hooks/exhaustive-deps

    const { prefetchRef, loadMoreRef } = useInfiniteScroll({
        hasMore,
        loading,
        page,
        onLoadMore: (nextPage) => {
            setPage(nextPage);
            loadMovies(selectedTag, nextPage * PAGE_LIMIT, true);
        },
    });

    return {
        movies,
        loading,
        hasMore,
        prefetchRef,
        loadMoreRef,
    };
}
