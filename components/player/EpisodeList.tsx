'use client';

import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { Button } from '@/components/ui/Button';
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation';
import { settingsStore, type EpisodeLayout } from '@/lib/store/settings-store';
import type { VideoResolutionInfo } from './hooks/useVideoResolution';
import type { ResolutionInfo } from '@/lib/hooks/useResolutionProbe';
import { getCachedResolution } from '@/lib/player/resolution-cache';
import { getSourceResolutionBadge, shouldExpandForCurrentSource } from '@/lib/player/source-list-utils';

/**
 * Number of episodes per page when the multi-column grid paginates.
 * Spec: paginate only when episodes exceed EPISODE_PAGINATION_THRESHOLD.
 */
export const EPISODES_PER_PAGE = 50;

/**
 * Episode lists shorter than this render without pagination chips, even
 * when grid layout is selected. Defaults to the spec value (100); can be
 * tightened in dev to exercise the UI without thousands of fixtures.
 */
export const EPISODE_PAGINATION_THRESHOLD = 100;

export interface EpisodePagination {
  /** Total number of pages (>=1) for the current episode list. */
  totalPages: number;
  /** Episodes visible on the requested page (after slicing). */
  pageItems: number[];
  /** Total number of episodes across all pages. */
  total: number;
  /** Whether pagination UI (prev/next + indicator) should be shown. */
  shouldPaginate: boolean;
}

/**
 * Pure pagination logic for the episode grid. Extracted so unit tests can
 * exercise page boundaries without spinning up React/DOM. Mirrors the
 * invariants used inside EpisodeList:
 *   - `layout === 'list'` never paginates.
 *   - `total <= threshold` never paginates, regardless of layout.
 *   - Otherwise, slice [page*size, page*size + size) and clamp page.
 */
export function computeEpisodePagination(
  total: number,
  layout: EpisodeLayout,
  page: number,
  pageSize: number = EPISODES_PER_PAGE,
  threshold: number = EPISODE_PAGINATION_THRESHOLD,
): EpisodePagination {
  const safeTotal = Math.max(0, Math.floor(total));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeThreshold = Math.max(0, Math.floor(threshold));

  if (layout === 'list' || safeTotal === 0) {
    return {
      totalPages: 1,
      pageItems: Array.from({ length: safeTotal }, (_, i) => i),
      total: safeTotal,
      shouldPaginate: false,
    };
  }

  if (safeTotal <= safeThreshold) {
    return {
      totalPages: 1,
      pageItems: Array.from({ length: safeTotal }, (_, i) => i),
      total: safeTotal,
      shouldPaginate: false,
    };
  }

  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(0, Math.floor(page)), totalPages - 1);
  const start = safePage * safePageSize;
  const end = Math.min(safeTotal, start + safePageSize);
  const pageItems = Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);

  return {
    totalPages,
    pageItems,
    total: safeTotal,
    shouldPaginate: totalPages > 1,
  };
}

interface Episode {
  name?: string;
  url: string;
}

export interface SourceInfo {
  id: string | number;
  source: string;
  sourceName?: string;
  latency?: number;
  pic?: string;
  typeName?: string;
  remarks?: string;
}

interface EpisodeListProps {
  episodes: Episode[] | null;
  currentEpisode: number;
  isReversed?: boolean;
  onEpisodeClick: (episode: Episode, index: number) => void;
  onToggleReverse?: (reversed: boolean) => void;
  // Optional source integration props
  sources?: SourceInfo[];
  currentSource?: string;
  onSourceChange?: (source: SourceInfo) => void;
  // Actual detected resolution for the current source
  currentResolution?: VideoResolutionInfo | null;
  // Probed resolutions for all sources (key: "source:id")
  sourceResolutions?: Record<string, ResolutionInfo | null>;
  sourceSectionCollapsed?: boolean;
  onSourceSectionCollapseChange?: (collapsed: boolean) => void;
  episodeSectionCollapsed?: boolean;
  onEpisodeSectionCollapseChange?: (collapsed: boolean) => void;
}

export function EpisodeList({
  episodes,
  currentEpisode,
  isReversed = false,
  onEpisodeClick,
  onToggleReverse,
  sources,
  currentSource,
  onSourceChange,
  currentResolution,
  sourceResolutions,
  sourceSectionCollapsed = false,
  onSourceSectionCollapseChange,
  episodeSectionCollapsed = false,
  onEpisodeSectionCollapseChange,
}: EpisodeListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourceItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  // Episode layout is a global preference (settings page). We subscribe to
  // settingsStore directly here so flipping it in PlayerSettings re-renders
  // the sidebar without touching the HLS player. This mirrors the pattern
  // used for episodeReverseOrder and deliberately stays outside the
  // PlayerSettingsSnapshot equality check.
  const [episodeLayout, setEpisodeLayoutState] = useState<EpisodeLayout>(() =>
    settingsStore.getSettings().episodeLayout
  );

  useEffect(() => {
    const syncEpisodeLayout = () => {
      setEpisodeLayoutState(settingsStore.getSettings().episodeLayout);
    };
    syncEpisodeLayout();
    return settingsStore.subscribe(syncEpisodeLayout);
  }, []);

  const setEpisodeLayout = useCallback((next: EpisodeLayout) => {
    const current = settingsStore.getSettings();
    settingsStore.saveSettings({ ...current, episodeLayout: next });
  }, []);

  const [episodePage, setEpisodePage] = useState(0);

  // Source latency state
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [isLoadingLatency, setIsLoadingLatency] = useState(false);

  const showSourceSelector = sources && sources.length > 1 && onSourceChange;

  // Helper: get best resolution badge for a source
  const getResBadge = useCallback((source: SourceInfo, isCurrent: boolean) => {
    const probeKey = `${source.source}:${source.id}`;
    return getSourceResolutionBadge({
      isCurrent,
      currentResolution: currentResolution || undefined,
      probedResolution: sourceResolutions?.[probeKey] || undefined,
      cachedResolution: getCachedResolution(source.source, source.id) || undefined,
      remarks: source.remarks,
    });
  }, [currentResolution, sourceResolutions]);

  // Current source info
  const currentSourceInfo = useMemo(() => {
    if (!sources || !currentSource) return null;
    return sources.find(s => s.source === currentSource) || null;
  }, [sources, currentSource]);

  // Sort sources by latency
  const initialLatencies = useMemo(() => {
    if (!sources) return {};
    return sources.reduce<Record<string, number>>((accumulator, source) => {
      if (source.latency !== undefined) {
        accumulator[source.source] = source.latency;
      }
      return accumulator;
    }, {});
  }, [sources]);

  const mergedLatencies = useMemo(() => ({
    ...initialLatencies,
    ...latencies,
  }), [initialLatencies, latencies]);

  const sortedSources = useMemo(() => {
    if (!sources) return [];
    return [...sources].sort((a, b) => {
      const latA = mergedLatencies[a.source] ?? a.latency ?? Infinity;
      const latB = mergedLatencies[b.source] ?? b.latency ?? Infinity;
      return latA - latB;
    });
  }, [mergedLatencies, sources]);

  const isSourceListOpen = !sourceSectionCollapsed && sourceExpanded;
  const forceExpandedForCurrentSource = !!currentSource && shouldExpandForCurrentSource(sortedSources, currentSource);
  const showAllVisibleSources = showAllSources || forceExpandedForCurrentSource;

  useEffect(() => {
    if (!isSourceListOpen || !currentSource) return;

    const frame = requestAnimationFrame(() => {
      sourceItemRefs.current[currentSource]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [currentSource, isSourceListOpen, showAllVisibleSources, sortedSources]);

  // Resolve source ID to its actual baseUrl for pinging
  const getSourcePingUrl = useCallback((sourceId: string): string | null => {
    const settings = settingsStore.getSettings();
    const allConfigs = [
      ...settings.sources,
      ...settings.premiumSources,
    ];
    const config = allConfigs.find(s => s.id === sourceId);
    return config?.baseUrl || null;
  }, []);

  // Initialize latencies from sources
  useEffect(() => {
    if (!sources) return;
    const hasMissing = sources.some((source) => source.latency === undefined);

    // Auto-refresh latencies for sources that don't have them
    if (hasMissing && sources.length > 1) {
      const autoRefresh = async () => {
        const missing = sources.filter(s => s.latency === undefined);
        const results = await Promise.all(
          missing.map(async (source) => {
            try {
              const pingUrl = getSourcePingUrl(source.source);
              if (!pingUrl) return { source: source.source, latency: undefined };
              const response = await fetch('/api/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: pingUrl }),
              });
              if (response.ok) {
                const data = await response.json();
                return { source: source.source, latency: data.latency as number | undefined };
              }
            } catch { /* ignore */ }
            return { source: source.source, latency: undefined };
          })
        );
        setLatencies(prev => {
          const updated = { ...prev };
          results.forEach(({ source, latency }) => {
            if (latency !== undefined) updated[source] = latency;
          });
          return updated;
        });
      };
      autoRefresh();
    }
  }, [sources, getSourcePingUrl]);

  // Refresh latencies
  const refreshLatencies = useCallback(async () => {
    if (!sources) return;
    setIsLoadingLatency(true);

    const results = await Promise.all(
      sources.map(async (source) => {
        try {
          const pingUrl = getSourcePingUrl(source.source);
          if (!pingUrl) return { source: source.source, latency: undefined };
          const response = await fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pingUrl }),
          });
          if (response.ok) {
            const data = await response.json();
            return { source: source.source, latency: data.latency };
          }
        } catch {
          // Ignore errors
        }
        return { source: source.source, latency: undefined };
      })
    );

    const newLatencies: Record<string, number> = {};
    results.forEach(({ source, latency }) => {
      if (latency !== undefined) {
        newLatencies[source] = latency;
      }
    });
    setLatencies(newLatencies);
    setIsLoadingLatency(false);
  }, [sources, getSourcePingUrl]);

  // Memoized display episodes - reversed if toggle is on
  const displayEpisodes = useMemo(() => {
    if (!episodes) return null;
    return isReversed ? [...episodes].reverse() : episodes;
  }, [episodes, isReversed]);

  // Pagination derived via the pure helper. The grid only paginates when
  // there are more than EPISODE_PAGINATION_THRESHOLD episodes (defaults to
  // 100 per the issue #218 #4 spec). Below that the grid renders flat and
  // no prev/next controls are shown.
  const pagination = useMemo(
    () =>
      computeEpisodePagination(
        displayEpisodes?.length ?? 0,
        episodeLayout,
        episodePage,
      ),
    [displayEpisodes, episodeLayout, episodePage],
  );

  // Keep the current episode's page visible when order/layout changes.
  // In list layout, or when no pagination is in play, we always pin to 0.
  useEffect(() => {
    if (!episodes || episodes.length === 0) {
      setEpisodePage(0);
      return;
    }
    if (episodeLayout === 'list' || episodes.length <= EPISODE_PAGINATION_THRESHOLD) {
      setEpisodePage(0);
      return;
    }
    const displayIndex = isReversed
      ? episodes.length - 1 - currentEpisode
      : currentEpisode;
    const totalPages = Math.max(1, Math.ceil(episodes.length / EPISODES_PER_PAGE));
    const page = Math.floor(displayIndex / EPISODES_PER_PAGE);
    setEpisodePage(Math.min(Math.max(0, page), totalPages - 1));
  }, [currentEpisode, episodes, isReversed, episodeLayout]);

  const pagedEpisodes = useMemo(() => {
    if (!displayEpisodes) return null;
    return pagination.pageItems.map((displayIndex) => ({
      episode: displayEpisodes[displayIndex],
      displayIndex,
    }));
  }, [displayEpisodes, pagination.pageItems]);

  const pageRangeLabels = useMemo(() => {
    if (!displayEpisodes) return [] as string[];
    if (!pagination.shouldPaginate) return [];
    const labels: string[] = [];
    for (let page = 0; page < pagination.totalPages; page++) {
      const start = page * EPISODES_PER_PAGE + 1;
      const end = Math.min((page + 1) * EPISODES_PER_PAGE, displayEpisodes.length);
      labels.push(`${start}-${end}`);
    }
    return labels;
  }, [displayEpisodes, pagination.shouldPaginate, pagination.totalPages]);

  // Map display index to original index
  const getOriginalIndex = useCallback((displayIndex: number) => {
    if (!episodes || !isReversed) return displayIndex;
    return episodes.length - 1 - displayIndex;
  }, [episodes, isReversed]);

  // Map original index to display index (for highlighting current episode)
  const getDisplayIndex = useCallback((originalIndex: number) => {
    if (!episodes || !isReversed) return originalIndex;
    return episodes.length - 1 - originalIndex;
  }, [episodes, isReversed]);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: !episodeSectionCollapsed,
    containerRef: listRef,
    currentIndex: getDisplayIndex(currentEpisode),
    itemCount: episodes?.length || 0,
    orientation: 'vertical',
    onNavigate: useCallback((index: number) => {
      buttonRefs.current[index]?.focus();
      buttonRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, []),
    onSelect: useCallback((displayIndex: number) => {
      if (episodes) {
        const originalIndex = getOriginalIndex(displayIndex);
        if (episodes[originalIndex]) {
          onEpisodeClick(episodes[originalIndex], originalIndex);
        }
      }
    }, [episodes, onEpisodeClick, getOriginalIndex]),
  });

  const showReverseToggle = episodes && episodes.length > 1;
  const currentEpisodeLabel = episodes?.[currentEpisode]?.name || `第${currentEpisode + 1}集`;

  return (
    <Card hover={false}>
      {showSourceSelector && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Layers size={18} className="text-[var(--text-color)]" />
              <span className="text-base sm:text-lg font-semibold text-[var(--text-color)]">
                源列表
              </span>
              <Badge variant="primary">{sources!.length}</Badge>
            </div>
            <button
              onClick={() => onSourceSectionCollapseChange?.(!sourceSectionCollapsed)}
              className="ml-auto p-1.5 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] transition-all duration-200 cursor-pointer"
              aria-label={sourceSectionCollapsed ? '展开源列表' : '折叠源列表'}
              title={sourceSectionCollapsed ? '展开源列表' : '折叠源列表'}
            >
              <Icons.ChevronDown
                size={16}
                className={`transition-transform duration-200 ${sourceSectionCollapsed ? '-rotate-90' : 'rotate-0'}`}
              />
            </button>
          </div>

          <div className="p-3 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <div className="flex items-start gap-3">
              <button
                onClick={() => {
                  if (!sourceSectionCollapsed) {
                    setSourceExpanded((current) => !current);
                  }
                }}
                className={`flex-1 min-w-0 flex items-center justify-between gap-3 text-left ${sourceSectionCollapsed ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-[var(--text-color)] truncate">
                    {currentSourceInfo?.sourceName || currentSourceInfo?.source || '当前来源'}
                  </span>
                  {currentResolution && (
                    <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-bold text-white ${currentResolution.color} flex-shrink-0`}>
                      {currentResolution.label}
                    </span>
                  )}
                </div>
                {!sourceSectionCollapsed && (
                  <Icons.ChevronDown
                    size={16}
                    className={`flex-shrink-0 text-[var(--text-color-secondary)] transition-transform duration-200 ${isSourceListOpen ? 'rotate-180' : 'rotate-0'}`}
                  />
                )}
              </button>

              {!sourceSectionCollapsed && (
                <Button
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    refreshLatencies();
                  }}
                  disabled={isLoadingLatency}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 min-h-[36px] md:px-3 md:py-1.5 md:text-sm"
                >
                  <Icons.RefreshCw size={12} className={isLoadingLatency ? 'animate-spin' : ''} />
                  刷新延迟
                </Button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-color-secondary)]">
              <span className="truncate">
                当前线路：{currentSourceInfo?.sourceName || currentSourceInfo?.source || '未知来源'}
              </span>
              <span className="shrink-0">共 {sources!.length} 条</span>
            </div>
          </div>

          {/* Expanded source list */}
          {isSourceListOpen && (
            <div className="mt-2 space-y-2">
              {(() => {
                const MAX_VISIBLE = 5;
                const visibleSources = showAllVisibleSources ? sortedSources : sortedSources.slice(0, MAX_VISIBLE);
                const hasMoreSources = sortedSources.length > MAX_VISIBLE;

                // Group sources by typeName
                const groupedByType = new Map<string, typeof visibleSources>();
                for (const source of visibleSources) {
                  const typeName = source.typeName || '';
                  if (!groupedByType.has(typeName)) groupedByType.set(typeName, []);
                  groupedByType.get(typeName)!.push(source);
                }
                const hasTypeGroups = groupedByType.size > 1 || (groupedByType.size === 1 && !groupedByType.has(''));

                return (
                  <>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {hasTypeGroups ? (
                        Array.from(groupedByType.entries()).map(([typeName, typeSources]) => (
                          <div key={typeName || '__default'}>
                            {typeName && (
                              <div className="text-[10px] font-medium text-[var(--text-color-secondary)] uppercase tracking-wider px-2 pt-2 pb-1">
                                {typeName}
                              </div>
                            )}
                            {typeSources.map((source, index) => {
                              const isCurrent = source.source === currentSource;
                              const latency = mergedLatencies[source.source] ?? source.latency;
                              const globalIndex = sortedSources.indexOf(source);
                              const badge = getResBadge(source, isCurrent);

                              return (
                                <button
                                  key={`${source.source}-${index}`}
                                  ref={(element) => { sourceItemRefs.current[source.source] = element; }}
                                  onClick={() => {
                                    if (!isCurrent) {
                                      onSourceChange!(source);
                                      setSourceExpanded(false);
                                    }
                                  }}
                                  className={`
                                    w-full p-2.5 rounded-[var(--radius-2xl)] text-left transition-all duration-200
                                    flex items-center gap-2.5
                                    ${isCurrent
                                      ? 'bg-[var(--accent-color)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-color)_50%,transparent)]'
                                      : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-[var(--text-color)] border border-[var(--glass-border)] cursor-pointer'
                                    }
                                  `}
                                  aria-current={isCurrent ? 'true' : undefined}
                                >
                                  <div className="w-10 h-14 rounded-[var(--radius-2xl)] overflow-hidden flex-shrink-0 bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)]">
                                    <Image
                                      src={source.pic || '/placeholder-poster.svg'}
                                      alt=""
                                      width={40}
                                      height={56}
                                      className="w-full h-full object-cover"
                                      unoptimized
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        const target = e.currentTarget as HTMLImageElement;
                                        if (target.dataset.fallback === '1') return;
                                        target.dataset.fallback = '1';
                                        target.src = '/placeholder-poster.svg';
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                      {source.sourceName || source.source}
                                      {badge ? (
                                        <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-bold text-white ${badge.color}`}>
                                          {badge.label}
                                        </span>
                                      ) : null}
                                    </div>
                                    {source.remarks && !badge && (
                                      <div className="text-[10px] text-[var(--text-color-secondary)] truncate mt-0.5">{source.remarks}</div>
                                    )}
                                    {latency !== undefined && (
                                      <div className="mt-0.5">
                                        <LatencyBadge latency={latency} />
                                      </div>
                                    )}
                                  </div>
                                  {isCurrent && (
                                    <Icons.Play size={14} className="flex-shrink-0" />
                                  )}
                                  {!isCurrent && globalIndex < 3 && (
                                    <Badge
                                      variant="secondary"
                                      className={`flex-shrink-0 ${globalIndex === 0 ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500' :
                                        globalIndex === 1 ? 'bg-gray-400/20 text-gray-600 border-gray-400' :
                                          'bg-orange-400/20 text-orange-600 border-orange-400'
                                      }`}
                                    >
                                      #{globalIndex + 1}
                                    </Badge>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        visibleSources.map((source, index) => {
                          const isCurrent = source.source === currentSource;
                          const latency = mergedLatencies[source.source] ?? source.latency;
                          const badge = getResBadge(source, isCurrent);

                          return (
                            <button
                              key={`${source.source}-${index}`}
                              ref={(element) => { sourceItemRefs.current[source.source] = element; }}
                              onClick={() => {
                                if (!isCurrent) {
                                  onSourceChange!(source);
                                  setSourceExpanded(false);
                                }
                              }}
                              className={`
                                w-full p-2.5 rounded-[var(--radius-2xl)] text-left transition-all duration-200
                                flex items-center gap-2.5
                                ${isCurrent
                                  ? 'bg-[var(--accent-color)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-color)_50%,transparent)]'
                                  : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-[var(--text-color)] border border-[var(--glass-border)] cursor-pointer'
                                }
                              `}
                              aria-current={isCurrent ? 'true' : undefined}
                            >
                              <div className="w-10 h-14 rounded-[var(--radius-2xl)] overflow-hidden flex-shrink-0 bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)]">
                                <Image
                                  src={source.pic || '/placeholder-poster.svg'}
                                  alt=""
                                  width={40}
                                  height={56}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.currentTarget as HTMLImageElement;
                                    if (target.dataset.fallback === '1') return;
                                    target.dataset.fallback = '1';
                                    target.src = '/placeholder-poster.svg';
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                  {source.sourceName || source.source}
                                  {badge ? (
                                    <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-bold text-white ${badge.color}`}>
                                      {badge.label}
                                    </span>
                                  ) : null}
                                </div>
                                {source.remarks && !badge && (
                                  <div className="text-[10px] text-[var(--text-color-secondary)] truncate mt-0.5">{source.remarks}</div>
                                )}
                                {latency !== undefined && (
                                  <div className="mt-0.5">
                                    <LatencyBadge latency={latency} />
                                  </div>
                                )}
                              </div>
                              {isCurrent && (
                                <Icons.Play size={14} className="flex-shrink-0" />
                              )}
                              {!isCurrent && index < 3 && (
                                <Badge
                                  variant="secondary"
                                  className={`flex-shrink-0 ${index === 0 ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500' :
                                    index === 1 ? 'bg-gray-400/20 text-gray-600 border-gray-400' :
                                      'bg-orange-400/20 text-orange-600 border-orange-400'
                                  }`}
                                >
                                  #{index + 1}
                                </Badge>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {hasMoreSources && (
                      <button
                        onClick={() => setShowAllSources((current) => !current)}
                        className="w-full mt-1.5 py-1.5 text-xs text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {showAllVisibleSources ? (
                          <>收起 <Icons.ChevronDown size={12} className="rotate-180" /></>
                        ) : (
                          <>展开更多 ({sortedSources.length - MAX_VISIBLE}) <Icons.ChevronDown size={12} /></>
                        )}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="text-lg sm:text-xl font-bold text-[var(--text-color)] mb-4 flex items-center gap-2 flex-wrap">
        <Icons.List size={20} className="sm:w-6 sm:h-6" />
        <span>选集</span>
        {episodes && (
          <Badge variant="primary">{episodes.length}</Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Layout toggle */}
          {showReverseToggle && !episodeSectionCollapsed && (
            <button
              onClick={() => setEpisodeLayout(episodeLayout === 'grid' ? 'list' : 'grid')}
              className={`
                p-1.5 rounded-[var(--radius-2xl)] transition-all duration-200 cursor-pointer
                ${episodeLayout === 'grid'
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'bg-[var(--glass-bg)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)]'
                }
              `}
              aria-label={episodeLayout === 'grid' ? '切换为列表' : '切换为网格'}
              title={episodeLayout === 'grid' ? '切换为列表' : '切换为网格'}
            >
              <Icons.Layers size={16} />
            </button>
          )}
          {/* Reverse order toggle button - only show when more than 1 episode */}
          {showReverseToggle && !episodeSectionCollapsed && (
            <button
              onClick={() => onToggleReverse?.(!isReversed)}
              className={`
                p-1.5 rounded-[var(--radius-2xl)] transition-all duration-200 cursor-pointer
                ${isReversed
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'bg-[var(--glass-bg)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)]'
                }
              `}
              aria-label={isReversed ? '恢复正序' : '倒序排列'}
              title={isReversed ? '恢复正序' : '倒序排列'}
            >
              <Icons.ArrowUpDown size={16} />
            </button>
          )}
          <button
            onClick={() => onEpisodeSectionCollapseChange?.(!episodeSectionCollapsed)}
            className="p-1.5 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] transition-all duration-200 cursor-pointer"
            aria-label={episodeSectionCollapsed ? '展开选集列表' : '折叠选集列表'}
            title={episodeSectionCollapsed ? '展开选集列表' : '折叠选集列表'}
          >
            <Icons.ChevronDown
              size={16}
              className={`transition-transform duration-200 ${episodeSectionCollapsed ? '-rotate-90' : 'rotate-0'}`}
            />
          </button>
        </div>
      </div>

      {episodeSectionCollapsed ? (
        <div className="rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-[var(--text-color-secondary)]">当前选集</span>
            <span className="font-medium text-[var(--text-color)] truncate">
              {currentEpisodeLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pagination header for long episode lists in grid mode */}
          {pagination.shouldPaginate && (
            <div
              className="flex items-center justify-between gap-2 rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-xs"
              role="navigation"
              aria-label="分页导航"
            >
              <button
                onClick={() => setEpisodePage((current) => Math.max(0, current - 1))}
                disabled={episodePage === 0}
                className="p-1 rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="上一页"
                title="上一页"
              >
                <Icons.ChevronLeft size={16} />
              </button>
              <span className="flex-1 text-center font-medium text-[var(--text-color)] tabular-nums" aria-live="polite">
                {pageRangeLabels[episodePage] || ''}
                <span className="mx-1.5 text-[var(--text-color-secondary)]">/</span>
                <span className="text-[var(--text-color-secondary)]">共 {pagination.total} 集</span>
              </span>
              <button
                onClick={() => setEpisodePage((current) => Math.min(pagination.totalPages - 1, current + 1))}
                disabled={episodePage >= pagination.totalPages - 1}
                className="p-1 rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:bg-[var(--glass-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer rotate-180"
                aria-label="下一页"
                title="下一页"
              >
                <Icons.ChevronLeft size={16} />
              </button>
            </div>
          )}

          <div
            ref={listRef}
            className={`max-h-[400px] sm:max-h-[600px] overflow-y-auto pr-1 ${
              episodeLayout === 'grid'
                ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2'
                : 'space-y-2'
            }`}
            role="radiogroup"
            aria-label="剧集选择"
          >
            {pagedEpisodes && pagedEpisodes.length > 0 ? (
              pagedEpisodes.map(({ episode, displayIndex }) => {
                const originalIndex = getOriginalIndex(displayIndex);
                const isCurrentEpisode = currentEpisode === originalIndex;
                const isGrid = episodeLayout === 'grid';

                return (
                  <button
                    key={originalIndex}
                    ref={(el) => { buttonRefs.current[displayIndex] = el; }}
                    onClick={() => onEpisodeClick(episode, originalIndex)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEpisodeClick(episode, originalIndex);
                      }
                    }}
                    tabIndex={0}
                    role="radio"
                    aria-checked={isCurrentEpisode}
                    aria-current={isCurrentEpisode ? 'true' : undefined}
                    aria-label={`${episode.name || `第 ${originalIndex + 1} 集`}${isCurrentEpisode ? '，当前播放' : ''}`}
                    className={`
                      rounded-[var(--radius-2xl)] transition-[var(--transition-fluid)] cursor-pointer
                      ${isGrid
                        ? 'px-2 py-2.5 text-center'
                        : 'w-full px-3 py-2 sm:px-4 sm:py-3 text-left'
                      }
                      ${isCurrentEpisode
                        ? 'bg-[var(--accent-color)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-color)_50%,transparent)] brightness-110'
                        : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-[var(--text-color)] border border-[var(--glass-border)]'
                      }
                      focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2
                    `}
                  >
                    <div className={`flex items-center ${isGrid ? 'justify-center gap-1' : 'justify-between'}`}>
                      <span className={`font-medium ${isGrid ? 'text-xs sm:text-sm truncate' : 'text-sm sm:text-base'}`}>
                        {episode.name || `第 ${originalIndex + 1} 集`}
                      </span>
                      {isCurrentEpisode && !isGrid && (
                        <Icons.Play size={16} />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)] col-span-full">
                <Icons.Inbox size={48} className="text-[var(--text-color-secondary)] mx-auto mb-2" />
                <p>暂无剧集信息</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
