import { NextRequest, NextResponse } from 'next/server';
import { buildSameOriginOptionsResponse, requireRelayAccess } from '@/lib/server/api-access';
import {
  fetchWithPolicy,
  OutboundPolicyError,
  sanitizeReferer,
  sanitizeUserAgent,
} from '@/lib/server/outbound-policy';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

export const runtime = 'nodejs';

const STREAM_TIMEOUT_MS = 20000;
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }

  return new URL(relative, base).href;
}

function buildProxyBase(customUa?: string, customReferer?: string): string {
  const searchParams = new URLSearchParams();
  if (customUa) {
    searchParams.set('ua', customUa);
  }
  if (customReferer) {
    searchParams.set('referer', customReferer);
  }
  searchParams.set('url', '');
  return `/api/iptv/stream?${searchParams.toString()}`;
}

function rewriteM3u8(content: string, baseUrl: string, proxyBase: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUri = resolveUrl(baseUrl, uri);
          return `URI="${proxyBase}${encodeURIComponent(absoluteUri)}"`;
        });
      }

      if (trimmed.startsWith('#')) {
        return line;
      }

      return `${proxyBase}${encodeURIComponent(resolveUrl(baseUrl, trimmed))}`;
    })
    .join('\n');
}

function isM3u8Url(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.m3u8') || lower.endsWith('.m3u');
}

function isM3u8ContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return lower.includes('mpegurl') ||
    lower.includes('x-mpegurl') ||
    lower.includes('vnd.apple.mpegurl') ||
    lower.includes('x-scpls');
}

function isAmbiguousContentType(contentType: string): boolean {
  if (!contentType) {
    return true;
  }

  const lower = contentType.toLowerCase();
  return lower.includes('text/plain') ||
    lower.includes('application/octet-stream') ||
    lower.includes('binary/octet-stream') ||
    lower.includes('text/html');
}

function isM3u8Content(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('#EXTM3U') || trimmed.startsWith('#EXT-X-');
}

function buildResponseHeaders(response: Response, fallbackContentType: string): Headers {
  const headers = new Headers();
  headers.set('Content-Type', response.headers.get('content-type') || fallbackContentType);
  headers.set('Cache-Control', 'public, max-age=60');

  const contentRange = response.headers.get('content-range');
  if (contentRange) {
    headers.set('Content-Range', contentRange);
  }

  const acceptRanges = response.headers.get('accept-ranges');
  if (acceptRanges) {
    headers.set('Accept-Ranges', acceptRanges);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return headers;
}

export async function GET(request: NextRequest) {
  const runtimeFeatures = getRuntimeFeatures();
  if (!runtimeFeatures.iptvEnabled) {
    return NextResponse.json(
      {
        error: 'IPTV relay is disabled on this deployment',
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
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const customUa = sanitizeUserAgent(request.nextUrl.searchParams.get('ua')) || DEFAULT_USER_AGENT;
    const customReferer = await sanitizeReferer(request.nextUrl.searchParams.get('referer'));
    const rangeHeader = request.headers.get('range');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    const response = await fetchWithPolicy(url, {
      headers: {
        Accept: '*/*',
        ...(customUa ? { 'User-Agent': customUa } : {}),
        ...(customReferer ? { Referer: customReferer } : {}),
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let isM3u8 = isM3u8Url(url) || isM3u8ContentType(contentType);
    const proxyBase = buildProxyBase(customUa, customReferer);

    if (!isM3u8 && isAmbiguousContentType(contentType)) {
      const cloned = response.clone();
      const reader = cloned.body?.getReader();

      if (reader) {
        const { value } = await reader.read();
        reader.releaseLock();

        if (value) {
          const text = new TextDecoder().decode(value.slice(0, 1024));
          if (isM3u8Content(text)) {
            isM3u8 = true;
          }
        }
      }

      if (isM3u8) {
        const fullText = await response.text();
        const rewritten = rewriteM3u8(fullText, url, proxyBase);
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store',
          },
        });
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: buildResponseHeaders(response, 'video/mp2t'),
      });
    }

    if (isM3u8) {
      const text = await response.text();
      const rewritten = rewriteM3u8(text, url, proxyBase);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: buildResponseHeaders(response, 'video/mp2t'),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = message.includes('abort');
    const status = error instanceof OutboundPolicyError ? error.status : isTimeout ? 504 : 502;

    return NextResponse.json(
      { error: isTimeout ? 'Stream request timed out' : message },
      { status },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return buildSameOriginOptionsResponse(request, 'GET, HEAD, OPTIONS');
}
