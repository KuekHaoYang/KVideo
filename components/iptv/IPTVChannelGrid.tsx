'use client';

/**
 * IPTVChannelGrid - Displays IPTV channels grouped by category with search
 * Uses pagination to handle large playlists without freezing.
 */

import { useState, useMemo } from 'react';
import { Icons } from '@/components/ui/Icon';
import type { M3UChannel } from '@/lib/utils/m3u-parser';
import type { IPTVSource } from '@/lib/store/iptv-store';

const PAGE_SIZE = 100;

interface IPTVChannelGridProps {
  channels: M3UChannel[];
  groups: string[];
  onSelect: (channel: M3UChannel) => void;
  activeChannel?: M3UChannel | null;
  channelsBySource?: Record<string, { channels: M3UChannel[]; groups: string[] }>;
  sources?: IPTVSource[];
}

export function IPTVChannelGrid({ channels, groups, onSelect, activeChannel, channelsBySource, sources }: IPTVChannelGridProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasMultipleSources = sources && sources.length > 1 && channelsBySource;

  // Get effective channels and groups based on selected source
  const { effectiveChannels, effectiveGroups } = useMemo(() => {
    if (!hasMultipleSources || !selectedSourceId) {
      return { effectiveChannels: channels, effectiveGroups: groups };
    }
    const sourceData = channelsBySource[selectedSourceId];
    if (!sourceData) return { effectiveChannels: channels, effectiveGroups: groups };
    return { effectiveChannels: sourceData.channels, effectiveGroups: sourceData.groups };
  }, [channels, groups, hasMultipleSources, selectedSourceId, channelsBySource]);

  const filteredChannels = useMemo(() => {
    let result = effectiveChannels;

    if (selectedGroup) {
      result = result.filter((c) => c.group === selectedGroup);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }

    return result;
  }, [effectiveChannels, selectedGroup, search]);

  // Reset visible count when filter changes
  const filterKey = `${selectedSourceId}-${selectedGroup}-${search}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  // Reset group when source changes
  const [lastSourceId, setLastSourceId] = useState(selectedSourceId);
  if (selectedSourceId !== lastSourceId) {
    setLastSourceId(selectedSourceId);
    setSelectedGroup(null);
  }

  const visibleChannels = filteredChannels.slice(0, visibleCount);
  const hasMore = visibleCount < filteredChannels.length;
  const orderedSources = useMemo(() => {
    if (!sources || !selectedSourceId) return sources || [];
    const selected = sources.find((source) => source.id === selectedSourceId);
    return selected ? [selected, ...sources.filter((source) => source.id !== selectedSourceId)] : sources;
  }, [sources, selectedSourceId]);
  const orderedGroups = useMemo(() => {
    if (!selectedGroup) return effectiveGroups;
    return [selectedGroup, ...effectiveGroups.filter((group) => group !== selectedGroup)];
  }, [effectiveGroups, selectedGroup]);

  if (channels.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--text-color-secondary)]">
        <Icons.TV size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-sm">暂无频道</p>
        <p className="text-xs mt-1">请先添加 M3U 直播源</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-4 z-10 -mx-2 px-2 py-2 rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_88%,transparent)] backdrop-blur-md">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-color-secondary)]" />
            <input
              type="text"
              placeholder="搜索频道..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-[var(--text-color-secondary)]">
          {filteredChannels.length === effectiveChannels.length
            ? `共 ${effectiveChannels.length} 个频道`
            : `${filteredChannels.length} / ${effectiveChannels.length} 个频道`}
        </div>

        {hasMultipleSources && sources && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedSourceId(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-2xl)] border transition-all cursor-pointer ${
                selectedSourceId === null
                  ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:border-[var(--accent-color)]/30'
              }`}
            >
              全部
            </button>
            {orderedSources.map((source) => {
              const sourceData = channelsBySource![source.id];
              if (!sourceData) return null;
              return (
                <button
                  key={source.id}
                  onClick={() => setSelectedSourceId(source.id === selectedSourceId ? null : source.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-2xl)] border transition-all cursor-pointer ${
                    selectedSourceId === source.id
                      ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                      : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:border-[var(--accent-color)]/30'
                  }`}
                >
                  {source.name} ({sourceData.channels.length})
                </button>
              );
            })}
          </div>
        )}

        {effectiveGroups.length > 0 && (
          <div className="mt-3 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`px-3 py-1 text-xs rounded-[var(--radius-2xl)] border transition-all cursor-pointer ${
                selectedGroup === null
                  ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:border-[var(--accent-color)]/30'
              }`}
            >
              全部 ({effectiveChannels.length})
            </button>
            {orderedGroups.map((group) => {
              const count = effectiveChannels.filter((channel) => channel.group === group).length;
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group === selectedGroup ? null : group)}
                  className={`px-3 py-1 text-xs rounded-[var(--radius-2xl)] border transition-all cursor-pointer ${
                    selectedGroup === group
                      ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                      : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:border-[var(--accent-color)]/30'
                  }`}
                >
                  {group} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {visibleChannels.map((channel, index) => (
          <button
            key={`${channel.name}-${index}`}
            onClick={() => onSelect(channel)}
            className={`group p-3 rounded-[var(--radius-2xl)] border text-left transition-all duration-200 cursor-pointer ${
              activeChannel?.url === channel.url
                ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-[0_4px_12px_rgba(var(--accent-color-rgb),0.3)]'
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] hover:border-[var(--accent-color)]/30'
            }`}
          >
            <div className="flex items-center gap-2">
              {channel.logo ? (
                <img
                  src={channel.logo}
                  alt=""
                  className="w-8 h-8 rounded object-contain bg-black/10 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                  activeChannel?.url === channel.url ? 'bg-white/20' : 'bg-[var(--glass-bg)]'
                }`}>
                  <Icons.TV size={14} className={activeChannel?.url === channel.url ? 'text-white/70' : 'text-[var(--text-color-secondary)]'} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${
                  activeChannel?.url === channel.url ? 'text-white' : 'text-[var(--text-color)]'
                }`}>
                  {channel.name}
                </p>
                <div className="flex items-center gap-1">
                  {channel.group && (
                    <p className={`text-[10px] truncate ${
                      activeChannel?.url === channel.url ? 'text-white/70' : 'text-[var(--text-color-secondary)]'
                    }`}>
                      {channel.group}
                    </p>
                  )}
                  {channel.routes && channel.routes.length > 1 && (
                    <span className={`text-[9px] px-1 rounded flex-shrink-0 ${
                      activeChannel?.url === channel.url ? 'bg-white/20 text-white/80' : 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                    }`}>
                      {channel.routes.length}线路
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center py-4">
          <button
            onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
            className="px-6 py-2 text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-all cursor-pointer"
          >
            加载更多 ({filteredChannels.length - visibleCount} 个剩余)
          </button>
        </div>
      )}

      {filteredChannels.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--text-color-secondary)]">
          未找到匹配的频道
        </div>
      )}
    </div>
  );
}
