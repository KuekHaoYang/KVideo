'use client';

import { useState, useEffect, useRef } from 'react';
import type { VideoSource } from '@/lib/types';
import { settingsStore } from '@/lib/store/settings-store';
import {
  getCachedResolution,
  setCachedResolution,
  shouldReuseCachedResolution,
  type ResolutionCacheEntry,
} from '@/lib/player/resolution-cache';

export type ResolutionInfo = ResolutionCacheEntry;

interface VideoToProbe {
  id: string | number;
  source: string;
  episodeIndex?: number;
}

function getSourceConfigsForProbe(videos: VideoToProbe[]): VideoSource[] {
  if (typeof window === 'undefined' || videos.length === 0) {
    return [];
  }

  const configuredSources = new Map<string, VideoSource>();
  const { sources, premiumSources } = settingsStore.getSettings();

  [...sources, ...premiumSources].forEach((source) => {
    if (source?.id) {
      configuredSources.set(source.id, source);
    }
  });

  return Array.from(new Set(videos.map((video) => video.source)))
    .map((sourceId) => configuredSources.get(sourceId))
    .filter((source): source is VideoSource => !!source);
}

/**
 * Hook that probes actual video resolutions via m3u8 manifests.
 * Returns a map of "source:id" -> ResolutionInfo.
 */
export function useResolutionProbe(videos: VideoToProbe[]): {
  resolutions: Record<string, ResolutionInfo | null>;
  isProbing: boolean;
} {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionInfo | null>>({});
  const [isProbing, setIsProbing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const probedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!videos || videos.length === 0) return;

    const cached: Record<string, ResolutionInfo | null> = {};
    const needProbe: VideoToProbe[] = [];

    for (const video of videos) {
      const resultKey = `${video.source}:${video.id}`;
      const requestKey = `${video.source}:${video.id}:${video.episodeIndex ?? 0}`;
      const cachedInfo = getCachedResolution(video.source, video.id);

      if (shouldReuseCachedResolution(cachedInfo, video.episodeIndex)) {
        cached[resultKey] = cachedInfo;
      } else if (!probedKeysRef.current.has(requestKey)) {
        needProbe.push(video);
        probedKeysRef.current.add(requestKey);
      }
    }

    if (Object.keys(cached).length > 0) {
      setResolutions((previous) => ({ ...previous, ...cached }));
    }

    if (needProbe.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsProbing(true);

    (async () => {
      try {
        const sourceConfigs = getSourceConfigsForProbe(needProbe);
        const response = await fetch('/api/probe-resolution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videos: needProbe, sourceConfigs }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setIsProbing(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) continue;

              const resultKey = `${data.source}:${data.id}`;

              if (data.resolution) {
                const resolution: ResolutionInfo = {
                  ...data.resolution,
                  origin: 'probed',
                  episodeIndex: typeof data.episodeIndex === 'number' ? data.episodeIndex : undefined,
                };
                setCachedResolution(data.source, data.id, resolution);
                setResolutions((previous) => ({ ...previous, [resultKey]: resolution }));
              } else {
                setResolutions((previous) => ({ ...previous, [resultKey]: null }));
              }
            } catch {
              // Ignore malformed SSE chunks and continue reading.
            }
          }
        }
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('[ResolutionProbe] Failed:', error);
        }
      } finally {
        setIsProbing(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [videos]);

  return { resolutions, isProbing };
}
