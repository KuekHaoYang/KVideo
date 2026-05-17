'use client';

/**
 * IPTVPlayer - Player for IPTV streams with controls, volume, progress, and sidebar.
 * Supports HLS (via HLS.js), native HLS (Safari), and direct video playback.
 * Features multi-level sidebar (source -> group -> channels), multi-route collapse,
 * and optimized search performance.
 */

import { useRef, useEffect, useState, useCallback, useMemo, useTransition } from 'react';
import Hls from 'hls.js';
import { Icons } from '@/components/ui/Icon';
import type { M3UChannel } from '@/lib/utils/m3u-parser';
import type { IPTVSource } from '@/lib/store/iptv-store';
import { settingsStore, DEFAULT_SEEK_STEP_SECONDS } from '@/lib/store/settings-store';

const HLS_LIVE_CONFIG: Partial<Hls['config']> = {
  enableWorker: true,
  lowLatencyMode: true,
  liveDurationInfinity: true,
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 3,
  levelLoadingTimeOut: 10000,
  fragLoadingTimeOut: 20000,
  // Prefer H.264 (avc) over HEVC (hev/hvc) for maximum browser compatibility
  preferManagedMediaSource: false,
};

const LOADING_TIMEOUT_MS = 30000;
const MAX_VISIBLE_ROUTES = 3;

interface IPTVPlayerProps {
  channel: M3UChannel;
  onClose: () => void;
  channels: M3UChannel[];
  onChannelChange: (channel: M3UChannel) => void;
  channelsBySource?: Record<string, { channels: M3UChannel[]; groups: string[] }>;
  sources?: IPTVSource[];
}

interface RouteUiState {
  channelKey: string;
  currentRouteIndex: number;
  showAllRoutes: boolean;
}

type RouteIndexUpdater = number | ((prev: number) => number);

function getProxiedUrl(url: string, ua?: string, referer?: string): string {
  let proxyUrl = `/api/iptv/stream?`;
  if (ua) proxyUrl += `ua=${encodeURIComponent(ua)}&`;
  if (referer) proxyUrl += `referer=${encodeURIComponent(referer)}&`;
  proxyUrl += `url=${encodeURIComponent(url)}`;
  return proxyUrl;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getSeekRange(video: HTMLVideoElement): { start: number; end: number; duration: number } | null {
  if (video.seekable.length > 0) {
    const start = video.seekable.start(0);
    const end = video.seekable.end(video.seekable.length - 1);
    if (isFinite(start) && isFinite(end) && end > start) {
      return { start, end, duration: end - start };
    }
  }

  if (isFinite(video.duration) && video.duration > 0) {
    return { start: 0, end: video.duration, duration: video.duration };
  }

  return null;
}

export function IPTVPlayer({ channel, onClose, channels, onChannelChange, channelsBySource, sources }: IPTVPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<HTMLButtonElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [filteredResults, setFilteredResults] = useState<M3UChannel[]>([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [sidebarVisibleCount, setSidebarVisibleCount] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekWindow, setSeekWindow] = useState<{ start: number; end: number; duration: number } | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekStepSeconds, setSeekStepSeconds] = useState(DEFAULT_SEEK_STEP_SECONDS);
  const channelKey = `${channel.sourceId ?? ''}::${channel.name}::${channel.url}`;
  const [routeUiState, setRouteUiState] = useState<RouteUiState>(() => ({
    channelKey,
    currentRouteIndex: 0,
    showAllRoutes: false,
  }));

  // Multi-level sidebar state
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Whether we have multi-source data
  const hasMultiSource = channelsBySource && sources && sources.length > 0;
  const activeSourceId = channel.sourceId || null;
  const activeGroupKey = activeSourceId && channel.group ? `${activeSourceId}::${channel.group}` : null;
  const activeSource = useMemo(
    () => (activeSourceId && sources ? sources.find((source) => source.id === activeSourceId) || null : null),
    [activeSourceId, sources]
  );
  const visibleExpandedSources = useMemo(() => {
    const next = new Set(expandedSources);
    if (activeSourceId) {
      next.add(activeSourceId);
    }
    return next;
  }, [expandedSources, activeSourceId]);
  const visibleExpandedGroups = useMemo(() => {
    const next = new Set(expandedGroups);
    if (activeGroupKey) {
      next.add(activeGroupKey);
    }
    return next;
  }, [expandedGroups, activeGroupKey]);
  const currentRouteIndex = routeUiState.channelKey === channelKey ? routeUiState.currentRouteIndex : 0;
  const showAllRoutes = routeUiState.channelKey === channelKey ? routeUiState.showAllRoutes : false;

  // Get current route URL
  const routes = channel.routes || [channel.url];
  const currentUrl = routes[currentRouteIndex] || channel.url;

  // Route display - collapse if > MAX_VISIBLE_ROUTES
  const visibleRoutes = showAllRoutes ? routes : routes.slice(0, MAX_VISIBLE_ROUTES);
  const hasMoreRoutes = routes.length > MAX_VISIBLE_ROUTES;

  // Auto-scroll to active channel in sidebar
  useEffect(() => {
    if (showSidebar && activeChannelRef.current) {
      activeChannelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showSidebar, channel.url]);

  useEffect(() => {
    const syncSeekStep = () => {
      setSeekStepSeconds(settingsStore.getSettings().seekStepSeconds ?? DEFAULT_SEEK_STEP_SECONDS);
    };

    syncSeekStep();
    const unsubscribe = settingsStore.subscribe(syncSeekStep);
    return () => unsubscribe();
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Controls auto-hide
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      const range = getSeekRange(video);
      setCurrentTime(video.currentTime);
      setSeekWindow(range);
      if (range) {
        setDuration(range.duration);
        setIsLive(false);
      } else {
        const dur = video.duration;
        if (isFinite(dur) && dur > 0) {
          setDuration(dur);
        }
        setIsLive(true);
      }
    };
    const onDurationChange = () => {
      const range = getSeekRange(video);
      setSeekWindow(range);
      if (range) {
        setDuration(range.duration);
        setIsLive(false);
      } else {
        const dur = video.duration;
        if (isFinite(dur) && dur > 0) {
          setDuration(dur);
        }
      }
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  const loadChannel = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setIsLoading(true);
    setIsLive(true);
    setCurrentTime(0);
    setDuration(0);
    setSeekWindow(null);

    // Clean up previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = undefined;
    }
    video.removeAttribute('src');
    video.load();

    const proxiedUrl = getProxiedUrl(url, channel.httpUserAgent, channel.httpReferrer);
    const hasCustomHeaders = !!(channel.httpUserAgent || channel.httpReferrer);
    // When custom headers are needed, skip direct attempt (browsers cannot set
    // User-Agent on XHR/fetch). Always go through our proxy which can forward
    // the headers server-side. This fixes audio-only issues on CCTV and similar.
    const initialUrl = hasCustomHeaders ? proxiedUrl : url;

    // Global loading timeout
    let loadingResolved = false;
    const markLoaded = () => {
      if (loadingResolved) return;
      loadingResolved = true;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = undefined;
      }
      setIsLoading(false);
    };
    const markError = (msg: string) => {
      if (loadingResolved) return;
      loadingResolved = true;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = undefined;
      }
      setIsLoading(false);
      setError(msg);
    };

    loadingTimeoutRef.current = setTimeout(() => {
      markError('加载超时，请尝试其他线路或频道');
    }, LOADING_TIMEOUT_MS);

    if (Hls.isSupported()) {
      const hls = new Hls(HLS_LIVE_CONFIG);
      hlsRef.current = hls;

      let triedProxy = false;
      let triedDirect = false;

      const tryDirectVideo = (directUrl: string) => {
        if (triedDirect) {
          markError('播放错误，请尝试其他线路或频道');
          return;
        }
        triedDirect = true;
        const vid = videoRef.current;
        if (!vid) return;
        vid.src = directUrl;
        vid.addEventListener('canplay', () => {
          markLoaded();
          vid.play().catch(() => {});
        }, { once: true });
        vid.addEventListener('error', () => {
          if (directUrl === url) {
            // Try proxied direct video
            const vid2 = videoRef.current;
            if (!vid2) return;
            vid2.src = proxiedUrl;
            vid2.addEventListener('canplay', () => {
              markLoaded();
              vid2.play().catch(() => {});
            }, { once: true });
            vid2.addEventListener('error', () => {
              markError('播放错误，请尝试其他线路或频道');
            }, { once: true });
          } else {
            markError('播放错误，请尝试其他线路或频道');
          }
        }, { once: true });
      };

      const tryWithProxy = () => {
        if (triedProxy) {
          tryDirectVideo(url);
          return;
        }
        triedProxy = true;
        hls.destroy();
        const hlsProxy = new Hls(HLS_LIVE_CONFIG);
        hlsRef.current = hlsProxy;
        hlsProxy.loadSource(proxiedUrl);
        hlsProxy.attachMedia(video);

        // Filter HEVC levels for proxy attempt too
        hlsProxy.on(Hls.Events.MANIFEST_PARSED, () => {
          filterHEVCLevels(hlsProxy);
          markLoaded();
          video.play().catch(() => {});
        });
        hlsProxy.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hlsProxy.recoverMediaError();
            } else {
              hlsProxy.destroy();
              hlsRef.current = null;
              tryDirectVideo(url);
            }
          }
        });
      };

      // Helper: Filter out HEVC levels that browser may not support (fixes audio-only issue)
      const filterHEVCLevels = (hlsInstance: Hls) => {
        if (!hlsInstance.levels || hlsInstance.levels.length <= 1) return;
        const h264Levels = hlsInstance.levels
          .map((level, index) => ({ level, index }))
          .filter(({ level }) => {
            const codec = level.videoCodec?.toLowerCase() || '';
            // Keep levels without HEVC codec (H.264 or unknown)
            return !codec.includes('hev') && !codec.includes('h265') && !codec.includes('hvc');
          });
        // If we have H.264 levels, restrict to those
        if (h264Levels.length > 0 && h264Levels.length < hlsInstance.levels.length) {
          console.info('[IPTV] Filtering HEVC levels, using H.264 only for compatibility');
          // Set level to first H.264 level
          hlsInstance.currentLevel = h264Levels[0].index;
        }
      };

      // First try initial URL (direct or proxied based on custom headers)
      hls.loadSource(initialUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Filter HEVC levels to prevent audio-only playback
        filterHEVCLevels(hls);
        markLoaded();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            tryWithProxy();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            tryWithProxy();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari/iOS)
      video.src = initialUrl;
      video.addEventListener('canplay', () => {
        markLoaded();
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => {
        // If direct failed, try proxy; if already proxied, fail
        if (initialUrl === proxiedUrl) {
          markError('播放错误');
          return;
        }
        video.src = proxiedUrl;
        video.addEventListener('canplay', () => {
          markLoaded();
          video.play().catch(() => {});
        }, { once: true });
        video.addEventListener('error', () => {
          markError('播放错误');
        }, { once: true });
      }, { once: true });
    } else {
      // Direct video fallback
      video.src = initialUrl;
      video.addEventListener('canplay', () => {
        markLoaded();
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => {
        if (initialUrl === proxiedUrl) {
          markError('播放错误，请尝试其他频道');
          return;
        }
        video.src = proxiedUrl;
        video.addEventListener('canplay', () => {
          markLoaded();
          video.play().catch(() => {});
        }, { once: true });
        video.addEventListener('error', () => {
          markError('播放错误，请尝试其他频道');
        }, { once: true });
      }, { once: true });
    }
  }, [channel.httpUserAgent, channel.httpReferrer]);

  // Load on channel/route change
  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadChannel(currentUrl);
    }, 0);
    return () => {
      clearTimeout(loadTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = undefined;
      }
    };
  }, [currentUrl, loadChannel]);

  // Playback controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    if (value > 0 && video.muted) video.muted = false;
  };

  const progressRef = useRef<HTMLDivElement>(null);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLive) return;
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar) return;
    const seekRange = getSeekRange(video);
    if (!seekRange) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = seekRange.start + ratio * seekRange.duration;
  };

  const progressPercent = useMemo(() => {
    if (seekWindow) {
      return Math.max(0, Math.min(100, ((currentTime - seekWindow.start) / seekWindow.duration) * 100));
    }
    if (!duration) return 0;
    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration, seekWindow]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  // Keyboard shortcuts (matching main video player)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      resetControlsTimeout();
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'escape':
          e.preventDefault();
          onClose();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          if (!isLive && isFinite(video.duration)) {
            video.currentTime = Math.min(video.duration, video.currentTime + seekStepSeconds);
          }
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          if (!isLive && isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.currentTime - seekStepSeconds);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          if (video.muted) video.muted = false;
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const VolumeIcon = isMuted || volume === 0 ? Icons.VolumeX : volume < 0.5 ? Icons.Volume1 : Icons.Volume2;

  // Debounce search with useTransition for non-blocking rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = sidebarSearch.toLowerCase().trim();
      if (!q) {
        setFilteredResults([]);
        setSidebarVisibleCount(50);
        return;
      }
      startSearchTransition(() => {
        const results = channels.filter(ch => ch.name.toLowerCase().includes(q));
        setFilteredResults(results);
        setSidebarVisibleCount(50);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [sidebarSearch, channels]);

  const isSearchMode = sidebarSearch.trim().length > 0;
  const getCurrentRouteUiState = useCallback((state: RouteUiState): RouteUiState => {
    if (state.channelKey === channelKey) {
      return state;
    }

    return {
      channelKey,
      currentRouteIndex: 0,
      showAllRoutes: false,
    };
  }, [channelKey]);

  const handleRouteIndexChange = useCallback((nextIndex: RouteIndexUpdater) => {
    setRouteUiState((previousState) => {
      const baseState = getCurrentRouteUiState(previousState);
      const resolvedIndex = typeof nextIndex === 'function'
        ? nextIndex(baseState.currentRouteIndex)
        : nextIndex;

      return {
        ...baseState,
        channelKey,
        currentRouteIndex: resolvedIndex,
      };
    });
  }, [channelKey, getCurrentRouteUiState]);

  const toggleRouteVisibility = useCallback(() => {
    setRouteUiState((previousState) => {
      const baseState = getCurrentRouteUiState(previousState);
      return {
        ...baseState,
        channelKey,
        showAllRoutes: !baseState.showAllRoutes,
      };
    });
  }, [channelKey, getCurrentRouteUiState]);

  // Toggle source expansion
  const toggleSource = useCallback((sourceId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  // Toggle group expansion
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleActiveSource = useCallback(() => {
    if (!activeSourceId) return;
    toggleSource(activeSourceId);
  }, [activeSourceId, toggleSource]);

  const toggleActiveGroup = useCallback(() => {
    if (!activeSourceId || !channel.group) return;
    setExpandedSources(prev => {
      const next = new Set(prev);
      next.add(activeSourceId);
      return next;
    });
    toggleGroup(`${activeSourceId}::${channel.group}`);
  }, [activeSourceId, channel.group, toggleGroup]);

  // Render a channel button
  const renderChannelButton = (ch: M3UChannel, i: number) => {
    const isActive = ch.name === channel.name && ch.url === channel.url;
    return (
      <button
        key={`${ch.sourceId || ''}-${ch.name}-${i}`}
        ref={isActive ? activeChannelRef : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onChannelChange(ch);
        }}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
          isActive
            ? 'bg-[var(--accent-color)] text-white'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 animate-pulse" />
          )}
          <span className="truncate flex-1">{ch.name}</span>
          {ch.routes && ch.routes.length > 1 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
              isActive ? 'bg-white/20' : 'bg-white/5 text-white/40'
            }`}>
              {ch.routes.length}线路
            </span>
          )}
        </div>
      </button>
    );
  };

  // Render multi-level sidebar content
  const renderMultiLevelSidebar = () => {
    if (!channelsBySource || !sources) return null;
    const orderedSources = activeSourceId
      ? [
        ...sources.filter((source) => source.id === activeSourceId),
        ...sources.filter((source) => source.id !== activeSourceId),
      ]
      : sources;

    return (
      <div className="p-1">
        {orderedSources.map(source => {
          const sourceData = channelsBySource[source.id];
          if (!sourceData || sourceData.channels.length === 0) return null;

          const isExpanded = visibleExpandedSources.has(source.id);
          const isActiveSource = source.id === activeSourceId;
          const orderedGroups = isActiveSource && channel.group
            ? [channel.group, ...sourceData.groups.filter((group) => group !== channel.group)]
            : sourceData.groups;

          return (
            <div key={source.id} className="mb-1">
              {/* Source Header */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSource(source.id); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActiveSource
                    ? 'bg-white/10 text-white'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icons.TV size={14} className="flex-shrink-0 text-[var(--accent-color)]" />
                  <span className="truncate">{source.name}</span>
                  <span className="text-[10px] text-white/40 flex-shrink-0">{sourceData.channels.length}</span>
                </div>
                <Icons.ChevronDown
                  size={14}
                  className={`flex-shrink-0 text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Source Content */}
              {isExpanded && (
                <div className="ml-2 border-l border-white/10 pl-1">
                  {orderedGroups.length > 0 ? (
                    // Has groups — show group-level
                    orderedGroups.map(group => {
                      const groupKey = `${source.id}::${group}`;
                      const groupExpanded = visibleExpandedGroups.has(groupKey);
                      const groupChannels = sourceData.channels.filter(ch => ch.group === group);
                      const isActiveGroup = groupKey === activeGroupKey;

                      return (
                        <div key={groupKey} className="mb-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                              isActiveGroup
                                ? 'bg-white/10 text-white'
                                : 'text-white/60 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Icons.Tag size={12} className="flex-shrink-0" />
                              <span className="truncate">{group}</span>
                              <span className="text-[10px] text-white/30 flex-shrink-0">{groupChannels.length}</span>
                            </div>
                            <Icons.ChevronDown
                              size={12}
                              className={`flex-shrink-0 text-white/30 transition-transform duration-200 ${groupExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                          {groupExpanded && (
                            <div className="ml-2">
                              {groupChannels.map((ch, i) => renderChannelButton(ch, i))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // No groups — show channels directly
                    sourceData.channels.map((ch, i) => renderChannelButton(ch, i))
                  )}

                  {/* Ungrouped channels */}
                  {sourceData.groups.length > 0 && (() => {
                    const ungrouped = sourceData.channels.filter(ch => !ch.group);
                    if (ungrouped.length === 0) return null;
                    return (
                      <div className="mb-0.5">
                        <div className="px-2 py-1 text-[10px] text-white/30">未分组</div>
                        {ungrouped.map((ch, i) => renderChannelButton(ch, i))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render flat channel list (search results or single-source fallback)
  const renderFlatChannelList = (channelList: M3UChannel[]) => {
    const visible = channelList.slice(0, sidebarVisibleCount);
    return (
      <div className="p-1">
        {visible.map((ch, i) => renderChannelButton(ch, i))}
        {channelList.length > sidebarVisibleCount && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSidebarVisibleCount(prev => prev + 50);
            }}
            className="w-full py-2 text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            显示更多 ({channelList.length - sidebarVisibleCount} 个频道)
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex"
      onMouseMove={resetControlsTimeout}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-controls]') || (e.target as HTMLElement).closest('[data-sidebar]')) return;
        togglePlay();
        resetControlsTimeout();
      }}
    >
      {/* Player Area */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          playsInline
          autoPlay
        />

        {/* Loading */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white/70 text-sm">加载中...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center" data-controls>
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); loadChannel(currentUrl); }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors cursor-pointer"
                >
                  重试
                </button>
                {routes.length > 1 && currentRouteIndex < routes.length - 1 && (
                  <button
                  onClick={(e) => { e.stopPropagation(); handleRouteIndexChange(prev => prev + 1); }}
                    className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-white text-sm transition-colors cursor-pointer"
                  >
                    切换线路
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div
          data-controls
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLive && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              )}
              <span className="text-white text-sm font-medium drop-shadow-lg">{channel.name}</span>
              {routes.length > 1 && (
                <span className="text-white/50 text-xs">线路 {currentRouteIndex + 1}/{routes.length}</span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
            >
              <Icons.X size={18} />
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div
          data-controls
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {/* Progress Bar (non-live only) */}
          {!isLive && duration > 0 && (
            <div className="px-4 pt-2">
              <div
                ref={progressRef}
                className="group h-1 hover:h-2 bg-white/20 rounded-full cursor-pointer transition-all relative"
                onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
              >
                <div
                  className="h-full bg-[var(--accent-color)] rounded-full relative pointer-events-none"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              {isPlaying ? <Icons.Pause size={20} /> : <Icons.Play size={20} />}
            </button>

            {/* Time Display */}
            {!isLive && duration > 0 && (
              <span className="text-white/70 text-xs tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            )}

            <div className="flex-1" />

            {/* Route Selector - collapsed */}
            {routes.length > 1 && (
              <div className="flex gap-1 items-center" data-controls>
                {visibleRoutes.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); handleRouteIndexChange(i); }}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors cursor-pointer ${
                      i === currentRouteIndex
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    线路{i + 1}
                  </button>
                ))}
                {hasMoreRoutes && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRouteVisibility(); }}
                    className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    {showAllRoutes ? '收起' : `+${routes.length - MAX_VISIBLE_ROUTES}`}
                  </button>
                )}
              </div>
            )}

            {/* Volume */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <VolumeIcon size={18} />
              </button>
              {showVolumeSlider && (
                <div className="ml-1 w-20 flex items-center" data-controls>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-1 accent-white cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Channel List */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              <Icons.List size={18} />
            </button>

            {/* Fullscreen */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Icons.Minimize size={18} /> : <Icons.Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div data-sidebar className="w-72 bg-[#111] border-l border-white/10 overflow-y-auto flex-shrink-0">
          <div className="sticky top-0 bg-[#111] z-10">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white text-sm font-medium">频道列表</h3>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSidebar(false); }}
                className="text-white/50 hover:text-white cursor-pointer"
              >
                <Icons.X size={16} />
              </button>
            </div>
            <div className="px-3 py-2 border-b border-white/10">
              <div className="relative">
                <Icons.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="搜索频道..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pl-7 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                {isSearching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
            {(activeSource || channel.group) && (
              <div className="px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">当前</span>
                  {activeSource && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActiveSource();
                      }}
                      className={`px-2 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${
                        activeSourceId && visibleExpandedSources.has(activeSourceId)
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      源: {activeSource.name}
                    </button>
                  )}
                  {channel.group && activeGroupKey && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActiveGroup();
                      }}
                      className={`px-2 py-1 rounded-full text-[11px] border transition-colors cursor-pointer ${
                        visibleExpandedGroups.has(activeGroupKey)
                          ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white'
                          : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      标签: {channel.group}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Content */}
          {isSearchMode ? (
            // Search mode — flat list of filtered results
            renderFlatChannelList(filteredResults)
          ) : hasMultiSource ? (
            // Multi-source mode — hierarchical list
            renderMultiLevelSidebar()
          ) : (
            // Single source or fallback — flat list
            renderFlatChannelList(channels)
          )}
        </div>
      )}
    </div>
  );
}
