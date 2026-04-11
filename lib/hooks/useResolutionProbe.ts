'use client';

import { useState, useEffect, useRef } from 'react';
import type { VideoSource } from '@/lib/types';
import { settingsStore } from '@/lib/store/settings-store';

export interface ResolutionInfo {
  width: number;
  height: number;
  label: string;
  color: string;
}

const CACHE_PREFIX = 'res:';

function getCached(source: string, id: string | number): ResolutionInfo | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${source}:${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCache(source: string, id: string | number, info: ResolutionInfo) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${source}:${id}`, JSON.stringify(info));
  } catch { /* ignore */ }
}

interface VideoToProbe {
  id: string | number;
  source: string;
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
 * Results are cached in sessionStorage.
 */
export function useResolutionProbe(videos: VideoToProbe[]): {
  resolutions: Record<string, ResolutionInfo | null>;
  isProbing: boolean;
} {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionInfo | null>>({});
  const [isProbing, setIsProbing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Track which videos we've already started probing to avoid duplicates
  const probedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!videos || videos.length === 0) return;

    // Check cache first, find which ones need probing
    const cached: Record<string, ResolutionInfo | null> = {};
    const needProbe: VideoToProbe[] = [];

    for (const v of videos) {
      const key = `${v.source}:${v.id}`;
      const cachedInfo = getCached(v.source, v.id);
      if (cachedInfo) {
        cached[key] = cachedInfo;
      } else if (!probedKeysRef.current.has(key)) {
        needProbe.push(v);
        probedKeysRef.current.add(key);
      }
    }

    // Set cached results immediately
    if (Object.keys(cached).length > 0) {
      setResolutions(prev => ({ ...prev, ...cached }));
    }

    if (needProbe.length === 0) return;

    // Abort previous request
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
              const key = `${data.source}:${data.id}`;
              if (data.resolution) {
                setCache(data.source, data.id, data.resolution);
                setResolutions(prev => ({ ...prev, [key]: data.resolution }));
              } else {
                setResolutions(prev => ({ ...prev, [key]: null }));
              }
            } catch { /* ignore */ }
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
