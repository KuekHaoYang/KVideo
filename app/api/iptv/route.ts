/**
 * IPTV Proxy API Route
 * Fetches M3U playlist files to avoid CORS issues
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const customUa = request.nextUrl.searchParams.get('ua');
  const customReferer = request.nextUrl.searchParams.get('referer');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    let refererOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;
    if (customReferer) {
      try {
        refererOrigin = new URL(customReferer).origin;
      } catch {
        refererOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      }
    }
    const response = await fetch(url, {
      headers: {
        'User-Agent': customUa || 'Mozilla/5.0 (compatible; KVideo/1.0)',
        ...(customReferer ? { 'Referer': customReferer } : {}),
        'Origin': refererOrigin,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch M3U playlist' },
      { status: 500 }
    );
  }
}
