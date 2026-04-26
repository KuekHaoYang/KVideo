import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedRequestIfConfigured } from '@/lib/server/api-access';
import { assertOutboundUrlAllowed, fetchWithPolicy, OutboundPolicyError } from '@/lib/server/outbound-policy';

export const runtime = 'nodejs';

function isAllowedDoubanImageHost(hostname: string): boolean {
  return hostname === 'doubanio.com' || hostname.endsWith('.doubanio.com');
}

export async function GET(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  const imageUrl = request.nextUrl.searchParams.get('url');
  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  try {
    const targetUrl = await assertOutboundUrlAllowed(imageUrl);
    if (!isAllowedDoubanImageHost(targetUrl.hostname)) {
      return NextResponse.json({ error: 'Only Douban image hosts are allowed' }, { status: 403 });
    }

    const imageResponse = await fetchWithPolicy(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/jpeg,image/png,image/gif,*/*;q=0.8',
        Referer: 'https://movie.douban.com/',
      },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status },
      );
    }

    if (!imageResponse.body) {
      return NextResponse.json(
        { error: 'Image response has no body' },
        { status: 500 },
      );
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
  } catch (error) {
    const status = error instanceof OutboundPolicyError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error fetching image' },
      { status },
    );
  }
}
