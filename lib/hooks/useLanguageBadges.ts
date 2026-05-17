'use client';

import { useState, useMemo, useCallback } from 'react';
import type { LanguageBadge } from '@/lib/types';

/**
 * Custom hook to collect and filter by vod_lang values from video results
 * Mirrors useTypeBadges pattern
 */
export function useLanguageBadges<T extends { vod_lang?: string }>(videos: T[]) {
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());

  // Collect and count language badges from videos
  const languageBadges = useMemo<LanguageBadge[]>(() => {
    const langMap = new Map<string, number>();

    videos.forEach(video => {
      if (video.vod_lang && video.vod_lang.trim()) {
        const lang = video.vod_lang.trim();
        langMap.set(lang, (langMap.get(lang) || 0) + 1);
      }
    });

    return Array.from(langMap.entries())
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  const effectiveSelectedLangs = useMemo(() => {
    const availableLangs = new Set(languageBadges.map((badge) => badge.lang));
    return new Set(
      Array.from(selectedLangs).filter((lang) => availableLangs.has(lang))
    );
  }, [languageBadges, selectedLangs]);

  // Filter videos by selected languages
  const filteredVideos = useMemo(() => {
    if (effectiveSelectedLangs.size === 0) {
      return videos;
    }

    return videos.filter(video =>
      video.vod_lang && effectiveSelectedLangs.has(video.vod_lang.trim())
    );
  }, [videos, effectiveSelectedLangs]);

  // Toggle language selection
  const toggleLang = useCallback((lang: string) => {
    setSelectedLangs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        newSet.delete(lang);
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  }, []);

  return {
    languageBadges,
    selectedLangs: effectiveSelectedLangs,
    filteredVideos,
    toggleLang,
  };
}
