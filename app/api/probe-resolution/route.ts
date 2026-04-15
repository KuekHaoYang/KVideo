/**
 * Probe Resolution API
 * Fetches actual video resolution by parsing m3u8 manifests.
 * Accepts a batch of videos and streams results back via SSE.
 */

import { NextRequest } from 'next/server';
import { getSourceById } from '@/lib/api/video-sources';
import { getVideoDetail } from '@/lib/api/detail-api';
import { fetchWithTimeout } from '@/lib/api/http-utils';
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

function getResolutionLabel(width: number, height: number): { label: string; color: string } {
  const h = Math.min(width, height); // height is the shorter side
  if (h >= 2160) return { label: '4K', color: 'bg-amber-500' };
  if (h >= 1440) return { label: '2K', color: 'bg-emerald-500' };
  if (h >= 1080) return { label: '1080P', color: 'bg-green-500' };
  if (h >= 720) return { label: '720P', color: 'bg-teal-500' };
  if (h >= 480) return { label: '480P', color: 'bg-sky-500' };
  if (h >= 360) return { label: '360P', color: 'bg-gray-500' };
  return { label: `${h}P`, color: 'bg-gray-500' };
}

function parseResolutionFromM3u8(content: string): { width: number; height: number } | null {
  const resolutions: { width: number; height: number }[] = [];
  const regex = /RESOLUTION=(\d+)x(\d+)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    resolutions.push({ width: parseInt(match[1]), height: parseInt(match[2]) });
  }
  if (resolutions.length === 0) return null;
  // Return highest resolution
  return resolutions.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
}

async function probeOne(video: ProbeRequest, providedConfigs: Map<string, VideoSource>): Promise<{
  id: string | number;
  source: string;
  episodeIndex?: number;
  resolution: { width: number; height: number; label: string; color: string } | null;
}> {
  try {
    const sourceConfig = providedConfigs.get(video.source) || getSourceById(video.source);
    if (!sourceConfig) return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null };

    // 1. Get detail to find first episode URL
    const detail = await getVideoDetail(video.id, sourceConfig);
    if (!detail.episodes || detail.episodes.length === 0) {
      return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null };
    }

    const episodeIndex = typeof video.episodeIndex === 'number'
      ? Math.min(Math.max(video.episodeIndex, 0), detail.episodes.length - 1)
      : 0;
    const targetUrl = detail.episodes[episodeIndex]?.url || detail.episodes[0]?.url;
    if (!targetUrl) return { id: video.id, source: video.source, episodeIndex, resolution: null };

    // 2. Fetch the m3u8 manifest
    let m3u8Content: string;
    try {
      const res = await fetchWithTimeout(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }, 8000);
      m3u8Content = await res.text();
    } catch {
      // Try with proxy
      try {
        // Can't call our own proxy from edge easily, so just return null
        return { id: video.id, source: video.source, episodeIndex, resolution: null };
      } catch {
        return { id: video.id, source: video.source, episodeIndex, resolution: null };
      }
    }

    // 3. Parse RESOLUTION from manifest
    const res = parseResolutionFromM3u8(m3u8Content);
    if (!res) {
      // Simple playlist without RESOLUTION tags — try to follow sub-playlist
      // Look for a URL in the content that might be a sub-playlist
      const lines = m3u8Content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && (trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8?'))) {
          try {
            const subUrl = trimmed.startsWith('http') ? trimmed : new URL(trimmed, targetUrl).toString();
            const subRes = await fetchWithTimeout(subUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
            }, 6000);
            const subContent = await subRes.text();
            const subResolution = parseResolutionFromM3u8(subContent);
            if (subResolution) {
              const labelInfo = getResolutionLabel(subResolution.width, subResolution.height);
              return { id: video.id, source: video.source, episodeIndex, resolution: { ...subResolution, ...labelInfo } };
            }
          } catch { /* continue */ }
          break; // Only try the first sub-playlist
        }
      }
      return { id: video.id, source: video.source, episodeIndex, resolution: null };
    }

    const labelInfo = getResolutionLabel(res.width, res.height);
    return { id: video.id, source: video.source, episodeIndex, resolution: { ...res, ...labelInfo } };
  } catch {
    return { id: video.id, source: video.source, episodeIndex: video.episodeIndex, resolution: null };
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

    // Limit batch size
    const batch = videos.slice(0, 30);

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
              const fallback = { id: current.id, source: current.source, resolution: null };
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
