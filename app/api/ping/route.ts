import { NextRequest, NextResponse } from 'next/server';
import { buildSameOriginOptionsResponse, requireRelayAccess } from '@/lib/server/api-access';
import { fetchWithPolicy, OutboundPolicyError } from '@/lib/server/outbound-policy';

export const runtime = 'nodejs';

async function pingUrl(url: string, method: 'HEAD' | 'GET'): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    await fetchWithPolicy(url, {
      method,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireRelayAccess(request);
  if (access.error) {
    return access.error;
  }

  try {
    const body = (await request.json()) as { url?: unknown };
    const url = typeof body.url === 'string' ? body.url : '';

    if (!url) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const startTime = performance.now();

    try {
      await pingUrl(url, 'HEAD');
      return NextResponse.json({
        latency: Math.round(performance.now() - startTime),
        success: true,
      });
    } catch {
      try {
        await pingUrl(url, 'GET');
        return NextResponse.json({
          latency: Math.round(performance.now() - startTime),
          success: true,
        });
      } catch (error) {
        const status = error instanceof OutboundPolicyError ? error.status : 200;
        return NextResponse.json(
          {
            latency: Math.round(performance.now() - startTime),
            success: false,
            timeout: !(error instanceof OutboundPolicyError),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          { status },
        );
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return buildSameOriginOptionsResponse(request, 'POST, OPTIONS');
}
