/**
 * Probe Resolution API
 * Fetches actual video resolution by parsing m3u8 manifests.
 * Accepts a batch of videos and streams results back via SSE.
 */

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
import type { VideoSource } from '@/lib/types';

export const runtime = 'edge';

interface ProbeRequest {
  id: string | number;
  source: string;
  episodeIndex?: number;
}

function isValidSourceConfig(value: unknown): value is VideoSource {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const source = value as Partial<VideoSource>;
  return typeof source.id === 'string' &&
    typeof source.name === 'string' &&
    typeof source.baseUrl === 'string' &&
    typeof source.searchPath === 'string' &&
    typeof source.detailPath === 'string';
}

function buildSourceConfigMap(rawConfigs: unknown): Map<string, VideoSource> {
  const configs = new Map<string, VideoSource>();
  if (!Array.isArray(rawConfigs)) {
    return configs;
  }

  for (const config of rawConfigs) {
    if (isValidSourceConfig(config)) {
      configs.set(config.id, config);
    }
  }

  return configs;
}

async function fetchManifestText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }, timeoutMs);
  return response.text();
}

async function probeManifestResolution(
  targetUrl: string,
  m3u8Content: string,
  detailHint: ResolutionProbeLabel | null
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

async function probeOne(video: ProbeRequest, providedConfigs: Map<string, VideoSource>): Promise<{
  id: string | number;
  source: string;
  episodeIndex?: number;
  resolution: ResolutionProbeLabel | null;
  resolutionOrigin: 'manifest' | 'hint';
}> {
  try {
    const sourceConfig = providedConfigs.get(video.source) || getSourceById(video.source);
    if (!sourceConfig) {
      return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null, resolutionOrigin: 'manifest' };
    }

    // 1. Get detail to find first episode URL
    const detail = await getVideoDetail(video.id, sourceConfig);
    if (!detail.episodes || detail.episodes.length === 0) {
      return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null, resolutionOrigin: 'manifest' };
    }

    const episodeIndex = typeof video.episodeIndex === 'number'
      ? Math.min(Math.max(video.episodeIndex, 0), detail.episodes.length - 1)
      : 0;
    const targetUrl = detail.episodes[episodeIndex]?.url || detail.episodes[0]?.url;
    if (!targetUrl) {
      return { id: video.id, source: video.source, episodeIndex, resolution: null, resolutionOrigin: 'manifest' };
    }

    const detailHint = extractResolutionHint(detail.vod_remarks, targetUrl);

    // 2. Fetch the m3u8 manifest
    let m3u8Content: string;
    try {
      m3u8Content = await fetchManifestText(targetUrl, 8000);
    } catch {
      return {
        id: video.id,
        source: video.source,
        episodeIndex,
        resolution: detailHint,
        resolutionOrigin: detailHint ? 'hint' : 'manifest',
      };
    }

    const probed = await probeManifestResolution(targetUrl, m3u8Content, detailHint);
    return { id: video.id, source: video.source, episodeIndex, resolution: probed.resolution, resolutionOrigin: probed.origin };
  } catch {
    return {
      id: video.id,
      source: video.source,
      episodeIndex: video.episodeIndex,
      resolution: null,
      resolutionOrigin: 'manifest',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videos: ProbeRequest[] = body.videos;
    const sourceConfigs = buildSourceConfigMap(body.sourceConfigs);

    if (!Array.isArray(videos) || videos.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing videos array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const batch = videos.slice(0, 100);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Process in parallel with concurrency limit
        const CONCURRENCY = 6;
        let index = 0;

        async function processNext(): Promise<void> {
          while (index < batch.length) {
            const current = batch[index++];
            try {
              const result = await probeOne(current, sourceConfigs);
              const line = `data: ${JSON.stringify(result)}\n\n`;
              controller.enqueue(encoder.encode(line));
            } catch {
              const fallback = { id: current.id, source: current.source, resolution: null, resolutionOrigin: 'manifest' };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`));
            }
          }
        }

        const workers = Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => processNext());
        await Promise.all(workers);
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
