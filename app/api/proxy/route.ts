import { NextRequest, NextResponse } from 'next/server';
import { processM3u8Content } from '@/lib/utils/proxy-utils';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

export const runtime = 'edge';

// Disable SSL verification for video sources with invalid certificates
// Note: This is not supported in Cloudflare Workers/Edge Runtime.
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function GET(request: NextRequest) {
    const runtimeFeatures = getRuntimeFeatures();

    if (!runtimeFeatures.mediaProxyEnabled) {
        return NextResponse.json(
            {
                error: 'External media proxy is disabled on this deployment',
                message: runtimeFeatures.restrictionSummary,
            },
            { status: 403 }
        );
    }

    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        // Extract headers to forward (only essential ones)
        const requestHeaders: Record<string, string> = {};
        const forwardHeaders = ['cookie', 'range'];

        forwardHeaders.forEach(key => {
            const value = request.headers.get(key);
            if (value) requestHeaders[key] = value;
        });

        const response = await fetchWithRetry({ url, request, headers: requestHeaders });

        // If upstream returned an error, pass it through with CORS headers
        if (!response.ok) {
            const errorText = await response.text();
            return new NextResponse(errorText || `Upstream error: ${response.status}`, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const contentType = response.headers.get('Content-Type');

        // Better M3U8 detection: check both content-type and actual content
        const isM3u8ByHeader = contentType &&
            (contentType.includes('application/vnd.apple.mpegurl') ||
                contentType.includes('application/x-mpegurl')) ||
            url.endsWith('.m3u8');

        // For potential M3U8 files, check content
        if (isM3u8ByHeader || url.includes('.m3u8')) {
            const text = await response.text();

            // Verify it's actually M3U8 content (starts with #EXTM3U or #EXT-X-)
            if (text.trim().startsWith('#EXTM3U') || text.trim().startsWith('#EXT-X-')) {
                const modifiedText = await processM3u8Content(text, url, request.nextUrl.origin);

                return new NextResponse(modifiedText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    },
                });
            }

            // Not M3U8 content, return as-is
            return new NextResponse(text, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'Content-Type': contentType || 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // For non-m3u8 content
        const headers = new Headers();
        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
                headers.set(key, value);
            }
        });

        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers,
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse(
            JSON.stringify({
                error: 'Proxy request failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                url: url
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
