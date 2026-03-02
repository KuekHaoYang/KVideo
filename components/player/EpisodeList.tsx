'use client';

import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { Button } from '@/components/ui/Button';
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation';
import { settingsStore } from '@/lib/store/settings-store';
import { extractQualityLabel } from '@/lib/utils/video';

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
}: EpisodeListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  // Source latency state
  const [latencies, setLatencies] = useState<Record<string, number>>({});
  const [isLoadingLatency, setIsLoadingLatency] = useState(false);

  const showSourceSelector = sources && sources.length > 1 && onSourceChange;

  // Current source info
  const currentSourceInfo = useMemo(() => {
    if (!sources || !currentSource) return null;
    return sources.find(s => s.source === currentSource) || null;
  }, [sources, currentSource]);

  // Sort sources by latency
  const sortedSources = useMemo(() => {
    if (!sources) return [];
    return [...sources].sort((a, b) => {
      const latA = latencies[a.source] ?? a.latency ?? Infinity;
      const latB = latencies[b.source] ?? b.latency ?? Infinity;
      return latA - latB;
    });
  }, [sources, latencies]);

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
    const initial: Record<string, number> = {};
    let hasMissing = false;
    sources.forEach(s => {
      if (s.latency !== undefined) {
        initial[s.source] = s.latency;
      } else {
        hasMissing = true;
      }
    });
    setLatencies(initial);

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
    enabled: true,
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

  return (
    <Card hover={false}>
      {/* Integrated Source Selector Header */}
      {showSourceSelector && (
        <div className="mb-4">
          <button
            onClick={() => setSourceExpanded(!sourceExpanded)}
            className="w-full flex items-center justify-between p-3 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-all duration-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icons.Layers size={16} className="flex-shrink-0 text-[var(--text-color-secondary)]" />
              <span className="text-sm font-medium text-[var(--text-color)] truncate">
                {currentSourceInfo?.sourceName || currentSourceInfo?.source || '当前来源'}
              </span>
              <Badge variant="primary" className="flex-shrink-0">{sources!.length}</Badge>
            </div>
            <Icons.ChevronDown
              size={16}
              className={`flex-shrink-0 text-[var(--text-color-secondary)] transition-transform duration-200 ${sourceExpanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Expanded source list */}
          {sourceExpanded && (
            <div className="mt-2 space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    refreshLatencies();
                  }}
                  disabled={isLoadingLatency}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1"
                >
                  <Icons.RefreshCw size={12} className={isLoadingLatency ? 'animate-spin' : ''} />
                  刷新延迟
                </Button>
              </div>
              {(() => {
                const MAX_VISIBLE = 5;
                const visibleSources = showAllSources ? sortedSources : sortedSources.slice(0, MAX_VISIBLE);
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
                              const latency = latencies[source.source] ?? source.latency;
                              const globalIndex = sortedSources.indexOf(source);

                              return (
                                <button
                                  key={`${source.source}-${index}`}
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
                                  {source.pic && (
                                    <div className="w-10 h-14 rounded-[var(--radius-2xl)] overflow-hidden flex-shrink-0 bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)]">
                                      <Image
                                        src={source.pic}
                                        alt=""
                                        width={40}
                                        height={56}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                      {source.sourceName || source.source}
                                      {(() => {
                                        const qb = extractQualityLabel(source.remarks);
                                        return qb ? (
                                          <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-bold text-white ${qb.color}`}>
                                            {qb.label}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    {source.remarks && !extractQualityLabel(source.remarks) && (
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
                          const latency = latencies[source.source] ?? source.latency;

                          return (
                            <button
                              key={`${source.source}-${index}`}
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
                              {source.pic && (
                                <div className="w-10 h-14 rounded-[var(--radius-2xl)] overflow-hidden flex-shrink-0 bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)]">
                                  <Image
                                    src={source.pic}
                                    alt=""
                                    width={40}
                                    height={56}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate flex items-center gap-1.5">
                                  {source.sourceName || source.source}
                                  {(() => {
                                    const qb = extractQualityLabel(source.remarks);
                                    return qb ? (
                                      <span className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-bold text-white ${qb.color}`}>
                                        {qb.label}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                {source.remarks && !extractQualityLabel(source.remarks) && (
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
                        onClick={() => setShowAllSources(!showAllSources)}
                        className="w-full mt-1.5 py-1.5 text-xs text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {showAllSources ? (
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

      {/* Episode List Header */}
      <h3 className="text-lg sm:text-xl font-bold text-[var(--text-color)] mb-4 flex items-center gap-2">
        <Icons.List size={20} className="sm:w-6 sm:h-6" />
        <span>选集</span>
        {episodes && (
          <Badge variant="primary">{episodes.length}</Badge>
        )}
        {/* Reverse order toggle button - only show when more than 1 episode */}
        {showReverseToggle && (
          <button
            onClick={() => onToggleReverse?.(!isReversed)}
            className={`
              ml-auto p-1.5 rounded-[var(--radius-2xl)] transition-all duration-200
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
      </h3>

      <div
        ref={listRef}
        className="max-h-[400px] sm:max-h-[600px] overflow-y-auto space-y-2 pr-2"
        role="radiogroup"
        aria-label="剧集选择"
      >
        {displayEpisodes && displayEpisodes.length > 0 ? (
          displayEpisodes.map((episode, displayIndex) => {
            const originalIndex = getOriginalIndex(displayIndex);
            const isCurrentEpisode = currentEpisode === originalIndex;

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
                  w-full px-3 py-2 sm:px-4 sm:py-3 rounded-[var(--radius-2xl)] text-left transition-[var(--transition-fluid)] cursor-pointer
                  ${isCurrentEpisode
                    ? 'bg-[var(--accent-color)] text-white shadow-[0_4px_12px_color-mix(in_srgb,var(--accent-color)_50%,transparent)] brightness-110'
                    : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] text-[var(--text-color)] border border-[var(--glass-border)]'
                  }
                  focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm sm:text-base">
                    {episode.name || `第 ${originalIndex + 1} 集`}
                  </span>
                  {isCurrentEpisode && (
                    <Icons.Play size={16} />
                  )}
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Icons.Inbox size={48} className="text-[var(--text-color-secondary)] mx-auto mb-2" />
            <p>暂无剧集信息</p>
          </div>
        )}
      </div>
    </Card>
  );
}
