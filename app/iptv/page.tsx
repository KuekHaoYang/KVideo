'use client';

/**
 * IPTV Page - Live TV channel viewer with M3U source management
 */

import { useState, useEffect, useMemo } from 'react';
import { useIPTVStore } from '@/lib/store/iptv-store';
import { IPTVSourceManager } from '@/components/iptv/IPTVSourceManager';
import { IPTVChannelGrid } from '@/components/iptv/IPTVChannelGrid';
import { IPTVPlayer } from '@/components/iptv/IPTVPlayer';
import { Icons } from '@/components/ui/Icon';
import { hasPermission, getSession } from '@/lib/store/auth-store';
import { useRuntimeFeatures } from '@/components/RuntimeFeaturesProvider';
import Link from 'next/link';
import type { M3UChannel } from '@/lib/utils/m3u-parser';

export default function IPTVPage() {
  const { iptvEnabled, restrictionSummary } = useRuntimeFeatures();
  const { sources, cachedChannels, cachedChannelsBySource, refreshSources, isLoading } = useIPTVStore();
  const [activeChannel, setActiveChannel] = useState<M3UChannel | null>(null);
  const [showManager, setShowManager] = useState(false);

  const canManageSources = hasPermission('iptv_source_management');
  const canAccessIPTV = hasPermission('iptv_access');
  const canUseBuiltinSources = hasPermission('iptv_builtin_sources');
  const visibleSources = useMemo(
    () => sources.filter((source) => canUseBuiltinSources || source.kind !== 'builtin'),
    [sources, canUseBuiltinSources]
  );
  const visibleSourceIds = useMemo(() => new Set(visibleSources.map((source) => source.id)), [visibleSources]);
  const visibleChannels = useMemo(
    () => cachedChannels.filter((channel) => !channel.sourceId || visibleSourceIds.has(channel.sourceId)),
    [cachedChannels, visibleSourceIds]
  );
  const visibleGroups = useMemo(
    () => Array.from(new Set(visibleChannels.map((channel) => channel.group).filter(Boolean))).sort() as string[],
    [visibleChannels]
  );
  const visibleChannelsBySource = useMemo(
    () =>
      Object.fromEntries(
        visibleSources
          .map((source) => [source.id, cachedChannelsBySource[source.id]])
          .filter(([, data]) => !!data)
      ),
    [visibleSources, cachedChannelsBySource]
  );

  // Auto-refresh on first load if we have sources but no cached channels
  useEffect(() => {
    if (!iptvEnabled) {
      return;
    }

    if (sources.length > 0 && cachedChannels.length === 0 && !isLoading) {
      refreshSources();
    }
  }, [iptvEnabled, sources.length, cachedChannels.length, isLoading, refreshSources]);

  // If auth is configured and user doesn't have iptv_access, show access denied
  if (!canAccessIPTV && getSession()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] bg-[image:var(--bg-image)]">
        <div className="text-center p-8">
          <Icons.TV size={48} className="mx-auto mb-4 text-[var(--text-color-secondary)] opacity-40" />
          <p className="text-[var(--text-color)] font-medium mb-2">无权访问 IPTV</p>
          <p className="text-sm text-[var(--text-color-secondary)] mb-4">请联系管理员开通权限</p>
          <Link href="/" className="text-sm text-[var(--accent-color)] hover:underline">返回首页</Link>
        </div>
      </div>
    );
  }

  if (!iptvEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] bg-[image:var(--bg-image)]">
        <div className="max-w-xl mx-auto px-6 py-8 text-center bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)]">
          <Icons.TV size={48} className="mx-auto mb-4 text-[var(--text-color-secondary)] opacity-40" />
          <p className="text-[var(--text-color)] font-medium mb-2">当前部署已禁用 IPTV</p>
          <p className="text-sm text-[var(--text-color-secondary)] mb-4">
            {restrictionSummary}
          </p>
          <Link href="/" className="text-sm text-[var(--accent-color)] hover:underline">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-[var(--bg-color)] bg-[image:var(--bg-image)] bg-fixed">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                  aria-label="返回首页"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-color)] flex items-center gap-2">
                    <Icons.TV size={24} className="text-[var(--accent-color)]" />
                    直播
                  </h1>
                  <p className="text-sm text-[var(--text-color-secondary)]">
                    {visibleChannels.length > 0 ? `${visibleChannels.length} 个频道` : 'IPTV 直播频道'}
                  </p>
                </div>
              </div>

              {canManageSources && (
                <button
                  onClick={() => setShowManager(!showManager)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] hover:border-[var(--accent-color)]/30 transition-all cursor-pointer"
                >
                  <Icons.Settings size={16} />
                  管理源
                </button>
              )}
            </div>
          </div>

          {/* Source Manager (collapsible) */}
          {showManager && (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6 mb-6">
              <IPTVSourceManager />
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-2 border-[var(--accent-color)]/30 border-t-[var(--accent-color)] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-[var(--text-color-secondary)]">正在加载频道列表...</p>
            </div>
          )}

          {/* Channel Grid */}
          {!isLoading && (
            <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6">
              <IPTVChannelGrid
                channels={visibleChannels}
                groups={visibleGroups}
                onSelect={setActiveChannel}
                activeChannel={activeChannel}
                channelsBySource={visibleChannelsBySource}
                sources={visibleSources}
              />
            </div>
          )}
        </div>

        {/* Player Overlay */}
        {activeChannel && (
          <IPTVPlayer
            channel={activeChannel}
            onClose={() => setActiveChannel(null)}
            channels={visibleChannels}
            onChannelChange={setActiveChannel}
            channelsBySource={visibleChannelsBySource}
            sources={visibleSources}
          />
        )}
      </div>
  );
}
