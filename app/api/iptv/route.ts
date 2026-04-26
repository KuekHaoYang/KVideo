import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithPolicy,
  OutboundPolicyError,
  sanitizeReferer,
  sanitizeUserAgent,
} from '@/lib/server/outbound-policy';
import { buildSameOriginOptionsResponse, requireRelayAccess } from '@/lib/server/api-access';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const access = await requireRelayAccess(request);
  if (access.error) {
    return access.error;
  }

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const customUa = sanitizeUserAgent(request.nextUrl.searchParams.get('ua'));
    const customReferer = await sanitizeReferer(request.nextUrl.searchParams.get('referer'));
    const response = await fetchWithPolicy(url, {
      headers: {
        'Accept': 'text/plain, application/vnd.apple.mpegurl, application/x-mpegurl;q=0.9, */*;q=0.8',
        ...(customUa ? { 'User-Agent': customUa } : {}),
        ...(customReferer ? { Referer: customReferer } : {}),
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: response.status },
      );
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    const status = error instanceof OutboundPolicyError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch M3U playlist' },
      { status },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return buildSameOriginOptionsResponse(request, 'GET, OPTIONS');
}
