import { NextRequest, NextResponse } from 'next/server';
import { buildSameOriginOptionsResponse, requireAuthenticatedRequestIfConfigured } from '@/lib/server/api-access';
import { fetchWithPolicy, OutboundPolicyError, assertOutboundUrlAllowed } from '@/lib/server/outbound-policy';

export const runtime = 'nodejs';

function buildDanmakuTarget(baseUrl: URL, action: 'search' | 'comments', keyword?: string, episodeId?: string): URL {
  const normalizedBase = new URL(baseUrl.toString().replace(/\/+$/, '/'));

  if (action === 'search') {
    normalizedBase.pathname = `${normalizedBase.pathname.replace(/\/$/, '')}/api/v2/search/episodes`;
    normalizedBase.search = `anime=${encodeURIComponent(keyword || '')}`;
    return normalizedBase;
  }

  normalizedBase.pathname = `${normalizedBase.pathname.replace(/\/$/, '')}/api/v2/comment/${encodeURIComponent(episodeId || '')}`;
  normalizedBase.search = 'withRelated=true';
  return normalizedBase;
}

export async function OPTIONS(request: NextRequest) {
  return buildSameOriginOptionsResponse(request, 'GET, OPTIONS');
}

export async function GET(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const apiUrl = searchParams.get('apiUrl');

  if (!action || !apiUrl || (action !== 'search' && action !== 'comments')) {
    return NextResponse.json({ error: 'Missing or invalid action/apiUrl parameter' }, { status: 400 });
  }

  try {
    const baseUrl = await assertOutboundUrlAllowed(apiUrl);
    const keyword = searchParams.get('keyword') || undefined;
    const episodeId = searchParams.get('episodeId') || undefined;

    if (action === 'search' && !keyword) {
      return NextResponse.json({ error: 'Missing keyword parameter' }, { status: 400 });
    }

    if (action === 'comments' && !episodeId) {
      return NextResponse.json({ error: 'Missing episodeId parameter' }, { status: 400 });
    }

    const targetUrl = buildDanmakuTarget(baseUrl, action, keyword, episodeId);
    const response = await fetchWithPolicy(targetUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KVideo/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream API returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    const status = error instanceof OutboundPolicyError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from danmaku API' },
      { status },
    );
  }
}
