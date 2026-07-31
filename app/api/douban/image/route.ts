import { NextResponse } from 'next/server';
import { buildDoubanImageCandidates } from '@/lib/server/douban-image';

export const runtime = 'edge';

const REQUEST_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    Accept: 'image/jpeg,image/png,image/gif,*/*;q=0.8',
    Referer: 'https://movie.douban.com/',
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
        return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
    }

    let lastStatus = 502;
    let lastError = 'Error fetching image';

    for (const candidate of buildDoubanImageCandidates(imageUrl)) {
        let imageResponse: Response;

        try {
            imageResponse = await fetch(candidate, { headers: REQUEST_HEADERS });
        } catch {
            // 线路不可达,换下一个镜像
            continue;
        }

        if (!imageResponse.ok) {
            lastStatus = imageResponse.status;
            lastError = imageResponse.statusText || 'Error fetching image';
            continue;
        }

        if (!imageResponse.body) {
            lastStatus = 500;
            lastError = 'Image response has no body';
            continue;
        }

        const headers = new Headers();
        const contentType = imageResponse.headers.get('content-type');
        if (contentType) {
            headers.set('Content-Type', contentType);
        }
        headers.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000');

        return new Response(imageResponse.body, {
            status: 200,
            headers,
        });
    }

    return NextResponse.json({ error: lastError }, { status: lastStatus });
}
