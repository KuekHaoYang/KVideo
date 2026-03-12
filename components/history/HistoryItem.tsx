/**
 * HistoryItem - Individual watch history item
 * Displays video thumbnail, title, episode, progress, and delete button
 */

import Image from 'next/image';
import { Icons } from '@/components/ui/Icon';
import { formatTime, formatDate } from '@/lib/utils/format-utils';
import { PosterImage } from './PosterImage';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { getSourceName } from '@/lib/utils/source-names';
import { storeGroupedSources } from '@/lib/utils/grouped-sources-cache';
import type { VideoHistoryItem } from '@/lib/types';

interface HistoryItemProps {
  item: VideoHistoryItem;
  onRemove: () => void;
  isPremium?: boolean;
}

export function HistoryItem({ item, onRemove, isPremium = false }: HistoryItemProps) {
  const getVideoUrl = (): string => {
    const params = new URLSearchParams({
      id: item.videoId.toString(),
      source: item.source,
      title: item.title,
      episode: item.episodeIndex.toString(),
    });
    // Store sourceMap in sessionStorage to avoid long URLs
    if (item.sourceMap && Object.keys(item.sourceMap).length > 1) {
      const groupData = Object.entries(item.sourceMap).map(([sourceName, videoId]) => ({
        id: videoId,
        source: sourceName,
        sourceName: getSourceName(sourceName),
      }));
      const cacheKey = storeGroupedSources(groupData);
      if (cacheKey) {
        params.set('gs', cacheKey);
      }
    }
    if (isPremium) {
      params.set('premium', '1');
    }
    return `/player?${params.toString()}`;
  };

  const handleClick = (event: React.MouseEvent) => {
    // Middle mouse or Ctrl/Cmd+click opens in new tab
    if (event.button === 1 || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      window.open(getVideoUrl(), '_blank');
      return;
    }
  };

  const progress = (item.playbackPosition / item.duration) * 100;
  const episodeText = item.episodes && item.episodes.length > 0
    ? item.episodes[item.episodeIndex]?.name || `第${item.episodeIndex + 1}集`
    : '';

  return (
    <div className="group bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)] rounded-[var(--radius-2xl)] p-3 hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all border border-transparent hover:border-[var(--glass-border)]">
      <a
        href={getVideoUrl()}
        onClick={(e) => {
          e.preventDefault();
          handleClick(e as any);
          if (!e.ctrlKey && !e.metaKey) {
            window.location.href = getVideoUrl();
          }
        }}
        onAuxClick={(e) => handleClick(e as any)}
        className="block"
      >
        <div className="flex gap-3">
          {/* Poster */}
          <PosterImage poster={item.poster} title={item.title} progress={progress} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[var(--text-color)] truncate group-hover:text-[var(--accent-color)] transition-colors mb-1">
              {item.title}
            </h3>
            {episodeText && (
              <p className="text-xs text-[var(--text-color-secondary)] mb-1">
                {episodeText}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-[var(--text-color-secondary)]">
              <span>{formatTime(item.playbackPosition)} / {formatTime(item.duration)}</span>
              <span>{formatDate(item.timestamp)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 self-start opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Favorite button */}
            <FavoriteButton
              videoId={item.videoId}
              source={item.source}
              title={item.title}
              poster={item.poster}
              remarks={episodeText}
              size={14}
              className="!p-1.5 !bg-transparent !border-0 !shadow-none hover:!bg-[var(--glass-bg)]"
              showTooltip={false}
              isPremium={isPremium}
            />

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="p-1.5 hover:bg-[var(--glass-bg)] rounded-full cursor-pointer"
              aria-label="删除"
            >
              <Icons.Trash size={14} className="text-[var(--text-color-secondary)]" />
            </button>
          </div>
        </div>
      </a>
    </div>
  );
}
