import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const apiUrl = searchParams.get('apiUrl');

  if (!action || !apiUrl) {
    return NextResponse.json(
      { error: 'Missing action or apiUrl parameter' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Normalize base URL (remove trailing slash)
  const baseUrl = apiUrl.replace(/\/+$/, '');

  try {
    let targetUrl: string;

    if (action === 'search') {
      const keyword = searchParams.get('keyword');
      if (!keyword) {
        return NextResponse.json(
          { error: 'Missing keyword parameter' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      targetUrl = `${baseUrl}/api/v2/search/episodes?anime=${encodeURIComponent(keyword)}`;
    } else if (action === 'comments') {
      const episodeId = searchParams.get('episodeId');
      if (!episodeId) {
        return NextResponse.json(
          { error: 'Missing episodeId parameter' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      targetUrl = `${baseUrl}/api/v2/comment/${encodeURIComponent(episodeId)}?withRelated=true`;
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "search" or "comments".' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KVideo/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream API returned ${response.status}` },
        { status: response.status, headers: CORS_HEADERS }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=3600', // Cache danmaku for 1 hour
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch from danmaku API' },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
