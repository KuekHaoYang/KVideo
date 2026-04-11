/**
 * IPTV Stream Proxy API Route
 * Proxies HLS manifests and media segments to avoid CORS issues.
 * For .m3u8/.m3u manifests, rewrites URLs to also route through this proxy.
 * Supports HLS, MPEG-TS, and other stream formats with automatic content detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

export const runtime = 'edge';

const STREAM_TIMEOUT_MS = 20000;
const REALISTIC_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    // Fallback: manual resolution
    const baseUrl = base.substring(0, base.lastIndexOf('/') + 1);
    return baseUrl + relative;
  }
}

function buildProxyBase(customUa?: string | null, customReferer?: string | null): string {
  let base = '/api/iptv/stream?';
  if (customUa) base += `ua=${encodeURIComponent(customUa)}&`;
  if (customReferer) base += `referer=${encodeURIComponent(customReferer)}&`;
  base += 'url=';
  return base;
}

function rewriteM3u8(content: string, baseUrl: string, proxyBase: string): string {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    // Skip empty lines
    if (!trimmed) return line;

    // Rewrite URI="..." in EXT-X-KEY, EXT-X-MAP, etc.
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const absoluteUri = resolveUrl(baseUrl, uri);
        return `URI="${proxyBase}${encodeURIComponent(absoluteUri)}"`;
      });
    }

    // Skip other comment lines
    if (trimmed.startsWith('#')) return line;

    // This is a segment/playlist URL line - rewrite it
    const absoluteUrl = resolveUrl(baseUrl, trimmed);
    return `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
  }).join('\n');
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
  if (!contentType) return true;
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export async function GET(request: NextRequest) {
  const runtimeFeatures = getRuntimeFeatures();

  if (!runtimeFeatures.iptvEnabled) {
    return NextResponse.json(
      {
        error: 'IPTV relay is disabled on this deployment',
        message: runtimeFeatures.restrictionSummary,
      },
      { status: 403 }
    );
  }

  const url = request.nextUrl.searchParams.get('url');
  const customUa = request.nextUrl.searchParams.get('ua');
  const customReferer = request.nextUrl.searchParams.get('referer');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const fetchHeaders: Record<string, string> = {
      'User-Agent': customUa || REALISTIC_USER_AGENT,
      'Accept': '*/*',
      'Referer': customReferer || `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
      'Connection': 'keep-alive',
    };

    // Forward Range header for partial content requests
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: fetchHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let isM3u8 = isM3u8Url(url) || isM3u8ContentType(contentType);
    const proxyBase = buildProxyBase(customUa, customReferer);

    // If content-type is ambiguous, check the response body for M3U header
    if (!isM3u8 && isAmbiguousContentType(contentType)) {
      const cloned = response.clone();
      // Read first 1KB to check for M3U8 header without consuming too much
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
        // Re-read the full body for M3U8 rewriting
        const fullText = await response.text();
        const rewritten = rewriteM3u8(fullText, url, proxyBase);
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Cache-Control': 'no-cache, no-store',
            ...CORS_HEADERS,
          },
        });
      }

      // Not M3U8 — stream original binary body directly
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'video/mp2t',
          'Cache-Control': 'no-cache',
          ...CORS_HEADERS,
        },
      });
    }

    if (isM3u8) {
      // Parse and rewrite manifest
      const text = await response.text();
      const rewritten = rewriteM3u8(text, url, proxyBase);

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          ...CORS_HEADERS,
        },
      });
    }

    // Non-M3U8 media content — pipe through directly
    const body = response.body;
    const forwardContentType = contentType || 'video/mp2t';

    const responseHeaders: Record<string, string> = {
      'Content-Type': forwardContentType,
      'Cache-Control': 'public, max-age=60',
      ...CORS_HEADERS,
    };

    // Forward range-related headers
    const contentRange = response.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;
    const contentLength = response.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const isTimeout = message.includes('abort');
    return NextResponse.json(
      { error: isTimeout ? 'Stream request timed out' : 'Failed to proxy stream' },
      { status: isTimeout ? 504 : 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
