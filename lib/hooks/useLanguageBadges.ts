'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Filter videos by selected languages
  const filteredVideos = useMemo(() => {
    if (selectedLangs.size === 0) {
      return videos;
    }

    return videos.filter(video =>
      video.vod_lang && selectedLangs.has(video.vod_lang.trim())
    );
  }, [videos, selectedLangs]);

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

  // Auto-cleanup: remove selected langs that no longer exist in badges
  useEffect(() => {
    const availableLangs = new Set(languageBadges.map(b => b.lang));

    setSelectedLangs(prev => {
      const filtered = new Set(
        Array.from(prev).filter(lang => availableLangs.has(lang))
      );

      if (filtered.size !== prev.size) {
        return filtered;
      }
      return prev;
    });
  }, [languageBadges]);

  return {
    languageBadges,
    selectedLangs,
    filteredVideos,
    toggleLang,
  };
}
