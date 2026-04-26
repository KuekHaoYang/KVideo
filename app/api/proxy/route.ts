import { NextRequest, NextResponse } from 'next/server';
import { processM3u8Content } from '@/lib/utils/proxy-utils';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';
import { requireRelayAccess, buildSameOriginOptionsResponse } from '@/lib/server/api-access';
import { OutboundPolicyError, getRelayForwardHeaders } from '@/lib/server/outbound-policy';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

export const runtime = 'nodejs';

function buildPassThroughHeaders(response: Response): Headers {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (
      [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers',
        'content-encoding',
        'content-length',
        'set-cookie',
        'transfer-encoding',
      ].includes(lowerKey)
    ) {
      return;
    }

    headers.set(key, value);
  });

  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return headers;
}

export async function GET(request: NextRequest) {
  const runtimeFeatures = getRuntimeFeatures();

  if (!runtimeFeatures.mediaProxyEnabled) {
    return NextResponse.json(
      {
        error: 'External media proxy is disabled on this deployment',
        message: runtimeFeatures.restrictionSummary,
      },
      { status: 403 },
    );
  }

  const access = await requireRelayAccess(request);
  if (access.error) {
    return access.error;
  }

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const response = await fetchWithRetry({
      url,
      headers: Object.fromEntries(getRelayForwardHeaders(request)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(errorText || `Upstream error: ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isM3u8ByHeader = contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      url.endsWith('.m3u8');

    if (isM3u8ByHeader || url.includes('.m3u8')) {
      const text = await response.text();

      if (text.trim().startsWith('#EXTM3U') || text.trim().startsWith('#EXT-X-')) {
        const modifiedText = await processM3u8Content(text, url, request.nextUrl.origin);
        return new NextResponse(modifiedText, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        });
      }

      return new NextResponse(text, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': contentType || 'text/plain',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: buildPassThroughHeaders(response),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof OutboundPolicyError ? error.status : 500;

    return NextResponse.json(
      {
        error: 'Proxy request failed',
        message,
        url,
      },
      { status },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return buildSameOriginOptionsResponse(request, 'GET, OPTIONS');
}
