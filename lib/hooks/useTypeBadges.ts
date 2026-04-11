'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TypeBadge } from '@/lib/types';

/**
 * Custom hook to automatically collect and track type badges from video results
 *
 * Features:
 * - Auto-collects unique type_name values
 * - Normalizes similar type names (e.g., "动作片" and "动作" merge)
 * - Tracks count per type
 * - Updates dynamically as videos are added/removed
 * - Removes badges when count reaches 0
 * - Supports filtering by selected types
 */

// Normalize type names to merge near-duplicates
function normalizeTypeName(type: string): string {
  // Collapse whitespace and trim
  let t = type.replace(/\s+/g, '').trim();
  // Apply NFC unicode normalization
  t = t.normalize('NFC');
  // Remove trailing 片/剧/类 suffix for grouping (e.g., "动作片" → "动作", "喜剧片" → "喜剧")
  // But keep standalone names like "电影", "电视剧" etc.
  if (t.length > 2 && (t.endsWith('片') || t.endsWith('剧') || t.endsWith('类'))) {
    t = t.slice(0, -1);
  }
  // Lowercase for English name normalization (e.g., "Action" vs "action")
  t = t.toLowerCase();
  return t;
}

export function useTypeBadges<T extends { type_name?: string }>(videos: T[]) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  // Collect and count type badges from videos
  const typeBadges = useMemo<TypeBadge[]>(() => {
    const typeMap = new Map<string, { display: string; count: number }>();

    videos.forEach(video => {
      if (video.type_name && video.type_name.trim()) {
        const raw = video.type_name.trim();
        const normalized = normalizeTypeName(raw);
        const existing = typeMap.get(normalized);
        if (existing) {
          existing.count++;
          // Prefer shorter display name (e.g., "动作" over "动作片")
          if (raw.length < existing.display.length) {
            existing.display = raw;
          }
        } else {
          typeMap.set(normalized, { display: raw, count: 1 });
        }
      }
    });

    // Convert to array and sort by count (descending)
    return Array.from(typeMap.entries())
      .map(([, val]) => ({ type: val.display, count: val.count }))
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  // Filter videos by selected types
  const filteredVideos = useMemo(() => {
    if (selectedTypes.size === 0) {
      return videos;
    }

    // Build a set of normalized selected types
    const normalizedSelected = new Set(
      Array.from(selectedTypes).map(normalizeTypeName)
    );

    return videos.filter(video =>
      video.type_name && normalizedSelected.has(normalizeTypeName(video.type_name.trim()))
    );
  }, [videos, selectedTypes]);

  // Toggle type selection - useCallback to prevent re-creation
  const toggleType = useCallback((type: string) => {
    // Update selected types immediately (high priority)
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, []);

  // Auto-cleanup: remove selected types that no longer exist in badges
  useEffect(() => {
    const availableTypes = new Set(typeBadges.map(b => b.type));

    setSelectedTypes(prev => {
      const filtered = new Set(
        Array.from(prev).filter(type => availableTypes.has(type))
      );

      // Only update if changed
      if (filtered.size !== prev.size) {
        return filtered;
      }
      return prev;
    });
  }, [typeBadges]);

  return {
    typeBadges,
    selectedTypes,
    filteredVideos,
    toggleType,
  };
}
