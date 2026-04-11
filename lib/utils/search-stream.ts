import { Video } from '@/lib/types';
import { getSourceName } from '@/lib/utils/source-names';
import { calculateRelevanceScore, hasMinimumMatch } from '@/lib/utils/search';
import { settingsStore } from '@/lib/store/settings-store';

/**
 * Check if a video's category matches any blocked keyword.
 */
function isCategoryBlocked(video: any, blockedCategories: string[]): boolean {
    if (blockedCategories.length === 0) return false;
    const typeName = (video.type_name || video.vod_class || '').toLowerCase();
    return blockedCategories.some(cat => typeName.includes(cat.toLowerCase()));
}

interface StreamHandlerParams {
    reader: ReadableStreamDefaultReader<Uint8Array>;
    onStart: (totalSources: number) => void;
    onVideos: (videos: Video[], source: string) => void;
    onProgress: (completedSources: number, totalVideosFound: number) => void;
    onComplete: () => void;
    onError: (message: string) => void;
    onPageInfo?: (maxPageCount: number) => void;
    currentQuery: string;
}

export async function processSearchStream({
    reader,
    onStart,
    onVideos,
    onProgress,
    onComplete,
    onError,
    onPageInfo,
    currentQuery,
}: StreamHandlerParams) {
    const decoder = new TextDecoder();
    let buffer = '';
    let timeoutId: NodeJS.Timeout | null = null;
    let isCompleted = false;

    // Auto-complete if no progress for 3 seconds
    const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            if (!isCompleted) {

                isCompleted = true;
                onComplete();
            }
        }, 3000);
    };

    try {
        resetTimeout(); // Start initial timeout
        const blockedCategories = settingsStore.getSettings().blockedCategories;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.type === 'start') {
                        onStart(data.totalSources);
                        resetTimeout();
                    } else if (data.type === 'videos') {
                        const newVideos: Video[] = data.videos
                            .filter((video: any) => hasMinimumMatch(video.vod_name, currentQuery))
                            .filter((video: any) => !isCategoryBlocked(video, blockedCategories))
                            .map((video: any) => ({
                                ...video,
                                sourceName: video.sourceDisplayName || getSourceName(video.source),
                                isNew: true,
                                relevanceScore: calculateRelevanceScore(video, currentQuery),
                            }));
                        onVideos(newVideos, data.source);
                        if (data.pagecount && onPageInfo) {
                            onPageInfo(data.pagecount);
                        }
                        resetTimeout();
                    } else if (data.type === 'progress') {
                        onProgress(data.completedSources, data.totalVideosFound);
                        resetTimeout();
                    } else if (data.type === 'complete') {
                        if (timeoutId) clearTimeout(timeoutId);
                        isCompleted = true;
                        if (data.maxPageCount && onPageInfo) {
                            onPageInfo(data.maxPageCount);
                        }
                        onComplete();
                    } else if (data.type === 'error') {
                        onError(data.message);
                    }
                } catch (error) {
                    console.error('Error parsing stream data:', error);
                }
            }
        }
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}
