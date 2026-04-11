import type {
    VideoSource,
    VideoDetail,
    ApiDetailResponse,
} from '@/lib/types';
import { fetchWithTimeout, withRetry } from './http-utils';
import { parseEpisodes } from './parsers';

/**
 * Get video detail from a single source
 */
export async function getVideoDetail(
    id: string | number,
    source: VideoSource
): Promise<VideoDetail> {
    const url = new URL(`${source.baseUrl}${source.detailPath}`);
    url.searchParams.set('ac', 'detail');
    url.searchParams.set('ids', id.toString());

    try {
        const response = await withRetry(async () => {
            const res = await fetchWithTimeout(url.toString(), {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    ...source.headers,
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            return res;
        });

        const data: ApiDetailResponse = await response.json();

        if (data.code !== 1 && data.code !== 0) {
            throw new Error(data.msg || 'Invalid API response');
        }

        if (!data.list || data.list.length === 0) {
            throw new Error('Video not found');
        }

        const videoData = data.list[0];

        // Handle multiple sources (separated by $$$)
        const playFrom = (videoData.vod_play_from || '').split('$$$');
        const playUrls = (videoData.vod_play_url || '').split('$$$');

        // Find the best source (prioritize m3u8)
        let selectedIndex = 0;

        // Try to find a source that contains 'm3u8' in its name or code
        const m3u8Index = playFrom.findIndex(code => code.toLowerCase().includes('m3u8'));
        if (m3u8Index !== -1 && m3u8Index < playUrls.length) {
            selectedIndex = m3u8Index;
        }

        // Parse episodes from the selected source
        const episodes = parseEpisodes(playUrls[selectedIndex] || '');

        return {
            vod_id: videoData.vod_id,
            vod_name: videoData.vod_name,
            vod_pic: videoData.vod_pic,
            vod_remarks: videoData.vod_remarks,
            vod_year: videoData.vod_year,
            vod_area: videoData.vod_area,
            vod_actor: videoData.vod_actor,
            vod_director: videoData.vod_director,
            vod_content: videoData.vod_content,
            type_name: videoData.type_name,
            vod_lang: videoData.vod_lang,
            episodes,
            source: source.id,
            source_code: playFrom[selectedIndex] || '',
        };
    } catch (error) {
        console.error(`Detail fetch failed for source ${source.name}:`, error);
        throw {
            code: 'DETAIL_FAILED',
            message: `Failed to fetch video detail from ${source.name}`,
            source: source.id,
            retryable: false,
        };
    }
}
