/**
 * Sort utility functions for search results
 */

import type { SortOption } from '@/lib/store/settings-store';
import type { Video } from '@/lib/types';

type SortableVideo = Video & {
  relevanceScore?: number;
  vod_score?: number | string;
};

function getRelevanceScore(video: SortableVideo): number {
  return typeof video.relevanceScore === 'number' ? video.relevanceScore : 0;
}

function getNumericRating(video: SortableVideo): number {
  const rawScore = typeof video.vod_score === 'string'
    ? parseFloat(video.vod_score)
    : video.vod_score;

  return typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : 0;
}

export function sortVideos(videos: Video[], sortBy: SortOption): Video[] {
  const sorted = [...videos] as SortableVideo[];

  switch (sortBy) {
    case 'relevance':
      // Sort by relevance score (highest first)
      return sorted.sort((a, b) => {
        const scoreA = getRelevanceScore(a);
        const scoreB = getRelevanceScore(b);
        return scoreB - scoreA;
      });

    case 'latency-asc':
      // Sort by latency (lowest first)
      return sorted.sort((a, b) => {
        const latencyA = a.latency || 99999;
        const latencyB = b.latency || 99999;
        return latencyA - latencyB;
      });

    case 'date-desc':
      // Sort by year (newest first)
      return sorted.sort((a, b) => {
        const yearA = parseInt(a.vod_year || '0');
        const yearB = parseInt(b.vod_year || '0');
        return yearB - yearA;
      });

    case 'date-asc':
      // Sort by year (oldest first)
      return sorted.sort((a, b) => {
        const yearA = parseInt(a.vod_year || '0');
        const yearB = parseInt(b.vod_year || '0');
        return yearA - yearB;
      });

    case 'rating-desc':
      // Sort by rating if available (placeholder for future implementation)
      return sorted.sort((a, b) => {
        const ratingA = getNumericRating(a);
        const ratingB = getNumericRating(b);
        return ratingB - ratingA;
      });

    case 'name-asc':
      // Sort by name A-Z
      return sorted.sort((a, b) => {
        return a.vod_name.localeCompare(b.vod_name, 'zh-CN');
      });

    case 'name-desc':
      // Sort by name Z-A
      return sorted.sort((a, b) => {
        return b.vod_name.localeCompare(a.vod_name, 'zh-CN');
      });

    case 'default':
    default:
      // Default: by relevance then latency
      return sorted.sort((a, b) => {
        const scoreA = getRelevanceScore(a);
        const scoreB = getRelevanceScore(b);

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        const latencyA = a.latency || 99999;
        const latencyB = b.latency || 99999;
        return latencyA - latencyB;
      });
  }
}
