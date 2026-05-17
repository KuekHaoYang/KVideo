import { NextResponse } from 'next/server';
import type { VideoSource } from '@/lib/types';
import { fetchWithPolicy } from '@/lib/server/outbound-policy';
import { normalizeSourceConfigList } from '@/lib/server/source-validation';

export const runtime = 'nodejs';
import { PREMIUM_SOURCES } from '@/lib/api/premium-sources';

interface PremiumCategoryVideo {
    vod_id: string | number;
    vod_name: string;
    vod_pic?: string;
    vod_remarks?: string;
    type_name?: string;
    source: string;
}

interface PremiumCategoryResponse {
    list?: Array<{
        vod_id: string | number;
        vod_name: string;
        vod_pic?: string;
        vod_remarks?: string;
        type_name?: string;
    }>;
}

async function handleCategoryRequest(
    sourceList: VideoSource[],
    categoryParam: string,
    page: number,
    limit: number
) {
    try {
        const sourceMap = new Map<string, string>(); // sourceId -> typeId

        if (categoryParam) {
            const parts = categoryParam.split(',');
            parts.forEach(part => {
                if (part.includes(':')) {
                    const [sId, tId] = part.split(':');
                    sourceMap.set(sId, tId);
                } else {
                    // Legacy: we can't guess without knowledge, but if we have sourceList we can try
                    const firstSource = sourceList.find(s => s.enabled);
                    if (firstSource) {
                        sourceMap.set(firstSource.id, part);
                    }
                }
            });
        }

        let targetSources = [];
        if (sourceMap.size > 0) {
            targetSources = sourceList.filter(s => sourceMap.has(s.id) && s.enabled);
        } else {
            targetSources = sourceList.filter(s => s.enabled);
        }

        if (targetSources.length === 0) {
            return NextResponse.json({ videos: [], error: 'No enabled sources provided or found' }, { status: 500 });
        }

        const fetchPromises = targetSources.map(async (source): Promise<PremiumCategoryVideo[]> => {
            try {
                const url = new URL(source.baseUrl);
                url.searchParams.set('ac', 'detail');
                url.searchParams.set('pg', page.toString());
                url.searchParams.set('limit', limit.toString());

                if (sourceMap.has(source.id)) {
                    url.searchParams.set('t', sourceMap.get(source.id)!);
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetchWithPolicy(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                });

                clearTimeout(timeoutId);

                if (!response.ok) return [];

                const data = (await response.json()) as PremiumCategoryResponse;
                return (data.list || []).map((item) => ({
                    vod_id: item.vod_id,
                    vod_name: item.vod_name,
                    vod_pic: item.vod_pic,
                    vod_remarks: item.vod_remarks,
                    type_name: item.type_name,
                    source: source.id,
                }));
            } catch (error) {
                console.error(`Failed to fetch from ${source.name}:`, error);
                return [];
            }
        });

        const results = await Promise.all(fetchPromises);

        const interleavedVideos: PremiumCategoryVideo[] = [];
        const maxLen = Math.max(...results.map(r => r.length));

        for (let i = 0; i < maxLen; i++) {
            for (let j = 0; j < results.length; j++) {
                if (results[j][i]) {
                    interleavedVideos.push(results[j][i]);
                }
            }
        }

        return NextResponse.json({ videos: interleavedVideos });

    } catch (error) {
        console.error('Category content error:', error);
        return NextResponse.json(
            { videos: [], error: 'Failed to fetch category content' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sources, category, page, limit } = body;
        const normalizedSources = await normalizeSourceConfigList(sources);

        return await handleCategoryRequest(
            normalizedSources,
            category || '',
            parseInt(page || '1'),
            parseInt(limit || '20')
        );
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    return await handleCategoryRequest(await normalizeSourceConfigList(PREMIUM_SOURCES), categoryParam, page, limit);
}
