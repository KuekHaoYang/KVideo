import { NextRequest, NextResponse } from 'next/server';
import { getVideoDetail } from '@/lib/api/client';
import { getSourceById } from '@/lib/api/video-sources';
import { requireAuthenticatedRequestIfConfigured } from '@/lib/server/api-access';
import { normalizeSourceConfig } from '@/lib/server/source-validation';
import type { VideoSource } from '@/lib/types';

export const runtime = 'nodejs';

async function resolveSourceConfig(source: unknown): Promise<VideoSource | null> {
  if (typeof source === 'string') {
    const builtInSource = getSourceById(source);
    return builtInSource ? normalizeSourceConfig(builtInSource) : null;
  }

  return normalizeSourceConfig(source);
}

async function handleDetailRequest(id: string | null, source: unknown) {
  if (!id) {
    return NextResponse.json(
      { error: 'Missing video ID parameter' },
      { status: 400 },
    );
  }

  const sourceConfig = await resolveSourceConfig(source);
  if (!sourceConfig) {
    return NextResponse.json(
      { error: 'Invalid source configuration' },
      { status: 400 },
    );
  }

  try {
    const videoDetail = await getVideoDetail(id, sourceConfig);

    return NextResponse.json({
      success: true,
      data: videoDetail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch video detail',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const source = searchParams.get('source');

    return handleDetailRequest(id, source);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  try {
    const body = (await request.json()) as { id?: unknown; source?: unknown };
    const id = typeof body.id === 'string' || typeof body.id === 'number' ? String(body.id) : null;

    return handleDetailRequest(id, body.source);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
