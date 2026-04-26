import { NextRequest } from 'next/server';
import { getSourceById } from '@/lib/api/video-sources';
import { getVideoDetail } from '@/lib/api/detail-api';
import { fetchWithTimeout } from '@/lib/api/http-utils';
import {
  extractResolutionHint,
  extractVariantPlaylistUrls,
  parseResolutionFromManifest,
  type ResolutionProbeLabel,
} from '@/lib/player/resolution-probe-utils';
import { requireAuthenticatedRequestIfConfigured } from '@/lib/server/api-access';
import { buildSourceConfigMap, normalizeSourceConfig } from '@/lib/server/source-validation';
import type { VideoSource } from '@/lib/types';

export const runtime = 'nodejs';

interface ProbeRequest {
  id: string | number;
  source: string;
  episodeIndex?: number;
}

interface ProbeRequestBody {
  videos?: unknown;
  sourceConfigs?: unknown;
}

function isProbeRequest(value: unknown): value is ProbeRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const request = value as Partial<ProbeRequest>;
  return (
    (typeof request.id === 'string' || typeof request.id === 'number') &&
    typeof request.source === 'string' &&
    (typeof request.episodeIndex === 'undefined' || typeof request.episodeIndex === 'number')
  );
}

async function fetchManifestText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    },
    timeoutMs,
  );
  return response.text();
}

async function probeManifestResolution(
  targetUrl: string,
  m3u8Content: string,
  detailHint: ResolutionProbeLabel | null,
): Promise<{ resolution: ResolutionProbeLabel | null; origin: 'manifest' | 'hint' }> {
  const directResolution = parseResolutionFromManifest(m3u8Content, targetUrl);
  if (directResolution) {
    return { resolution: directResolution, origin: 'manifest' };
  }

  const variantUrls = extractVariantPlaylistUrls(m3u8Content, targetUrl).slice(0, 4);
  for (const variantUrl of variantUrls) {
    const variantHint = extractResolutionHint(variantUrl);
    if (variantHint?.width || variantHint?.height) {
      return { resolution: variantHint, origin: 'manifest' };
    }

    try {
      const variantContent = await fetchManifestText(variantUrl, 6000);
      const variantResolution = parseResolutionFromManifest(variantContent, variantUrl);
      if (variantResolution) {
        return { resolution: variantResolution, origin: 'manifest' };
      }
    } catch {
      // Continue trying the next variant.
    }
  }

  const fallbackHint = extractResolutionHint(targetUrl, m3u8Content) || detailHint;
  return {
    resolution: fallbackHint,
    origin: fallbackHint ? 'hint' : 'manifest',
  };
}

async function resolveSourceConfig(sourceId: string, providedConfigs: Map<string, VideoSource>): Promise<VideoSource | null> {
  const providedSource = providedConfigs.get(sourceId);
  if (providedSource) {
    return providedSource;
  }

  const builtInSource = getSourceById(sourceId);
  return builtInSource ? normalizeSourceConfig(builtInSource) : null;
}

async function probeOne(video: ProbeRequest, providedConfigs: Map<string, VideoSource>) {
  try {
    const sourceConfig = await resolveSourceConfig(video.source, providedConfigs);
    if (!sourceConfig) {
      return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null, resolutionOrigin: 'manifest' as const };
    }

    const detail = await getVideoDetail(video.id, sourceConfig);
    if (!detail.episodes || detail.episodes.length === 0) {
      return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null, resolutionOrigin: 'manifest' as const };
    }

    const episodeIndex = typeof video.episodeIndex === 'number'
      ? Math.min(Math.max(video.episodeIndex, 0), detail.episodes.length - 1)
      : 0;
    const targetUrl = detail.episodes[episodeIndex]?.url || detail.episodes[0]?.url;
    if (!targetUrl) {
      return { id: video.id, source: video.source, episodeIndex, resolution: null, resolutionOrigin: 'manifest' as const };
    }

    const detailHint = extractResolutionHint(detail.vod_remarks, targetUrl);

    try {
      const m3u8Content = await fetchManifestText(targetUrl, 8000);
      const probed = await probeManifestResolution(targetUrl, m3u8Content, detailHint);
      return { id: video.id, source: video.source, episodeIndex, resolution: probed.resolution, resolutionOrigin: probed.origin };
    } catch {
      return {
        id: video.id,
        source: video.source,
        episodeIndex,
        resolution: detailHint,
        resolutionOrigin: detailHint ? 'hint' as const : 'manifest' as const,
      };
    }
  } catch {
    return {
      id: video.id,
      source: video.source,
      episodeIndex: video.episodeIndex,
      resolution: null,
      resolutionOrigin: 'manifest' as const,
    };
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAuthenticatedRequestIfConfigured(request);
  if (access.error) {
    return access.error;
  }

  try {
    const body = (await request.json()) as ProbeRequestBody;
    const videos = Array.isArray(body.videos) ? body.videos.filter(isProbeRequest) : [];
    const sourceConfigs = await buildSourceConfigMap(body.sourceConfigs, 50);

    if (videos.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing videos array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const batch = videos.slice(0, 100);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const concurrency = 6;
        let index = 0;

        async function processNext(): Promise<void> {
          while (index < batch.length) {
            const current = batch[index++];
            try {
              const result = await probeOne(current, sourceConfigs);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
            } catch {
              const fallback = {
                id: current.id,
                source: current.source,
                resolution: null,
                resolutionOrigin: 'manifest',
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`));
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(concurrency, batch.length) }, () => processNext()),
        );
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
