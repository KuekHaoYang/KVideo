import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'movie'; // movie or tv

    try {
        const url = `https://movie.douban.com/j/search_tags?type=${type}&source=index`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://movie.douban.com/',
            },
            next: { revalidate: 86400 }, // Cache tags for 24 hours
        });

        if (!response.ok) {
            throw new Error(`Douban API returned ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Douban Tags API error:', error);
        return NextResponse.json(
            { tags: [], error: 'Failed to fetch tags' },
            { status: 500 }
        );
    }
}
