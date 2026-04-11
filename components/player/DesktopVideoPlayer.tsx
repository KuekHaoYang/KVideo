'use client';

import React from 'react';
import { useDesktopPlayerState } from './hooks/useDesktopPlayerState';
import { useDesktopPlayerLogic } from './hooks/useDesktopPlayerLogic';
import { useHlsPlayer } from './hooks/useHlsPlayer';
import { useAutoSkip } from './hooks/useAutoSkip';
import { useStallDetection } from './hooks/useStallDetection';
import { useVideoResolution } from './hooks/useVideoResolution';
import { DesktopControlsWrapper } from './desktop/DesktopControlsWrapper';
import { DesktopOverlayWrapper } from './desktop/DesktopOverlayWrapper';
import { DanmakuCanvas } from './DanmakuCanvas';
import { usePlayerSettings } from './hooks/usePlayerSettings';
import { useDanmaku } from './hooks/useDanmaku';
import { useIsIOS, useIsMobile } from '@/lib/hooks/mobile/useDeviceDetection';
import { useDoubleTap } from '@/lib/hooks/mobile/useDoubleTap';
import { settingsStore, DEFAULT_SEEK_STEP_SECONDS } from '@/lib/store/settings-store';
import { premiumModeSettingsStore } from '@/lib/store/premium-mode-settings';
import './web-fullscreen.css';

type WebFullscreenSize = 'full' | 'large' | 'focused';

const WEB_FULLSCREEN_SIZE_KEY = 'kvideo-web-fullscreen-size';
const WEB_FULLSCREEN_SIZE_ORDER: WebFullscreenSize[] = ['full', 'large', 'focused'];
const WEB_FULLSCREEN_SCALE: Record<WebFullscreenSize, number> = {
  full: 1,
  large: 0.92,
  focused: 0.84,
};

interface ViewportMetrics {
  width: number;
  height: number;
}

type LegacyInlineVideoProps = React.VideoHTMLAttributes<HTMLVideoElement> & {
  'webkit-playsinline'?: 'true';
};

const LEGACY_INLINE_VIDEO_PROPS: LegacyInlineVideoProps = {
  'webkit-playsinline': 'true',
};

function readViewportMetrics(): ViewportMetrics {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth ?? 0),
    height: Math.round(viewport?.height ?? window.innerHeight ?? 0),
  };
}

interface DesktopVideoPlayerProps {
  src: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  // Episode navigation props for auto-skip/auto-next
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  // Danmaku props
  videoTitle?: string;
  episodeName?: string;
  isPremium?: boolean;
  // Resolution callback
  onResolutionDetected?: (info: import('./hooks/useVideoResolution').VideoResolutionInfo) => void;
}

export function DesktopVideoPlayer({
  src,
  poster,
  onError,
  onTimeUpdate,
  initialTime = 0,
  shouldAutoPlay = false,
  totalEpisodes = 1,
  currentEpisodeIndex = 0,
  onNextEpisode,
  isReversed = false,
  videoTitle = '',
  episodeName = '',
  isPremium = false,
  onResolutionDetected,
}: DesktopVideoPlayerProps) {
  const { refs, data, actions } = useDesktopPlayerState();
  const { fullscreenType: settingsFullscreenType } = usePlayerSettings(isPremium);
  const isIOS = useIsIOS();
  const isMobile = useIsMobile();
  const [viewportMetrics, setViewportMetrics] = React.useState<ViewportMetrics>(() => readViewportMetrics());
  const [seekStepSeconds, setSeekStepSeconds] = React.useState(DEFAULT_SEEK_STEP_SECONDS);
  const [webFullscreenSize, setWebFullscreenSize] = React.useState<WebFullscreenSize>(() => {
    if (typeof window === 'undefined') return 'full';
    const saved = localStorage.getItem(WEB_FULLSCREEN_SIZE_KEY);
    return saved === 'large' || saved === 'focused' || saved === 'full' ? saved : 'full';
  });
  const [fullscreenClock, setFullscreenClock] = React.useState('');

  // Detect actual video resolution
  const videoResolution = useVideoResolution(refs.videoRef);

  // Notify parent when resolution is detected
  React.useEffect(() => {
    if (videoResolution && onResolutionDetected) {
      onResolutionDetected(videoResolution);
    }
  }, [videoResolution, onResolutionDetected]);

  // Danmaku
  const { danmakuEnabled, comments: danmakuComments } = useDanmaku({
    videoTitle,
    episodeName,
    episodeIndex: currentEpisodeIndex,
  });

  const updateViewportMetrics = React.useCallback(() => {
    setViewportMetrics((current) => {
      const next = readViewportMetrics();
      if (current.width === next.width && current.height === next.height) {
        return current;
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    updateViewportMetrics();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updateViewportMetrics);
    window.addEventListener('orientationchange', updateViewportMetrics);
    visualViewport?.addEventListener('resize', updateViewportMetrics);

    return () => {
      window.removeEventListener('resize', updateViewportMetrics);
      window.removeEventListener('orientationchange', updateViewportMetrics);
      visualViewport?.removeEventListener('resize', updateViewportMetrics);
    };
  }, [updateViewportMetrics]);

  // Use user preference for fullscreen type, resolving 'auto' to device default
  // Auto Rules:
  // - Mobile: Window Fullscreen (Better for Danmaku/Controls)
  // - Desktop: Native Fullscreen (Better for PiP/Performance)
  const fullscreenType = settingsFullscreenType === 'auto'
    ? (isIOS ? 'window' : isMobile ? 'window' : 'native') // Treat all mobile as window for consistency if auto
    : settingsFullscreenType;

  const isLandscape = viewportMetrics.width > viewportMetrics.height;

  // Check if we need to force landscape (iOS + Fullscreen + Portrait)
  const shouldForceLandscape = data.fullscreenMode === 'window' && isIOS && !isLandscape;

  React.useEffect(() => {
    updateViewportMetrics();

    if (data.fullscreenMode !== 'window') return;

    const rafId = window.requestAnimationFrame(updateViewportMetrics);
    const timeoutId = window.setTimeout(updateViewportMetrics, 250);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [data.fullscreenMode, src, updateViewportMetrics]);

  React.useEffect(() => {
    localStorage.setItem(WEB_FULLSCREEN_SIZE_KEY, webFullscreenSize);
  }, [webFullscreenSize]);

  React.useEffect(() => {
    const store = isPremium ? premiumModeSettingsStore : settingsStore;

    const syncSeekStep = () => {
      setSeekStepSeconds(store.getSettings().seekStepSeconds ?? DEFAULT_SEEK_STEP_SECONDS);
    };

    syncSeekStep();
    const unsubscribe = store.subscribe(syncSeekStep);
    return () => unsubscribe();
  }, [isPremium]);

  React.useEffect(() => {
    if (!data.isFullscreen) {
      setFullscreenClock('');
      return;
    }

    const formatter = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const updateClock = () => {
      setFullscreenClock(formatter.format(new Date()));
    };

    updateClock();
    const interval = window.setInterval(updateClock, 30000);
    return () => window.clearInterval(interval);
  }, [data.isFullscreen]);

  // Initialize HLS Player
  useHlsPlayer({
    videoRef: refs.videoRef,
    src,
    isPremium,
    autoPlay: shouldAutoPlay
  });

  const {
    videoRef,
    containerRef,
    moreMenuTimeoutRef,
  } = refs;

  const {
    isPlaying,
    currentTime,
    duration,
  } = data;

  const {
    setShowControls,
    setBufferedTime,
    setIsLoading,
  } = actions;

  // Reset loading state and show spinner when source changes
  React.useEffect(() => {
    setIsLoading(true);
    setBufferedTime(0);
  }, [src, setBufferedTime, setIsLoading]);

  const logic = useDesktopPlayerLogic({
    src,
    initialTime,
    shouldAutoPlay,
    onError,
    onTimeUpdate,
    refs,
    data,
    actions,
    fullscreenType,
    isForceLandscape: shouldForceLandscape,
    seekStepSeconds,
  });

  // Auto-skip intro/outro and auto-next episode
  const { isTransitioningToNextEpisode } = useAutoSkip({
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isPremium,
    totalEpisodes,
    currentEpisodeIndex,
    onNextEpisode,
    isReversed,
    src,
  });

  // Sensitive stalling detection (e.g. video stuck but HTML5 state says playing)
  useStallDetection({
    videoRef,
    isPlaying: data.isPlaying,
    isDraggingProgressRef: refs.isDraggingProgressRef,
    setIsLoading: actions.setIsLoading,
    isTransitioningToNextEpisode
  });

  const {
    handleMouseMove,
    handleTouchToggleControls,
    togglePlay,
    handlePlay,
    handlePause,
    handleTimeUpdateEvent,
    handleLoadedMetadata,
    handleProgressEvent,
    handleVideoError,
  } = logic;

  const cycleWebFullscreenSize = React.useCallback(() => {
    setWebFullscreenSize((current) => {
      const currentIndex = WEB_FULLSCREEN_SIZE_ORDER.indexOf(current);
      return WEB_FULLSCREEN_SIZE_ORDER[(currentIndex + 1) % WEB_FULLSCREEN_SIZE_ORDER.length];
    });
  }, []);

  const webFullscreenStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (data.fullscreenMode !== 'window') return undefined;
    if (viewportMetrics.width <= 0 || viewportMetrics.height <= 0) return undefined;

    const stageWidth = shouldForceLandscape ? viewportMetrics.height : viewportMetrics.width;
    const stageHeight = shouldForceLandscape ? viewportMetrics.width : viewportMetrics.height;

    return {
      ['--kvideo-viewport-width' as string]: `${viewportMetrics.width}px`,
      ['--kvideo-viewport-height' as string]: `${viewportMetrics.height}px`,
      ['--kvideo-stage-viewport-width' as string]: `${stageWidth}px`,
      ['--kvideo-stage-viewport-height' as string]: `${stageHeight}px`,
      ['--kvideo-web-scale' as string]: WEB_FULLSCREEN_SCALE[webFullscreenSize].toString(),
    };
  }, [data.fullscreenMode, shouldForceLandscape, viewportMetrics, webFullscreenSize]);

  const stageClassName = data.fullscreenMode === 'window'
    ? 'kvideo-stage kvideo-web-fullscreen-stage'
    : 'kvideo-stage absolute inset-0';

  // Mobile double-tap gesture for skip forward/backward
  const { handleTap } = useDoubleTap({
    onSingleTap: handleTouchToggleControls,
    onDoubleTapLeft: () => {
      logic.skipBackward();
      handleMouseMove(); // Reset 3s auto-hide timer
    },
    onDoubleTapRight: () => {
      logic.skipForward();
      handleMouseMove(); // Reset 3s auto-hide timer
    },
    onSkipContinueLeft: () => {
      logic.skipBackward();
      handleMouseMove();
    },
    onSkipContinueRight: () => {
      logic.skipForward();
      handleMouseMove();
    },
    isSkipModeActive: data.showSkipForwardIndicator || data.showSkipBackwardIndicator,
  });

  return (
    <div
      ref={containerRef}
      className={`kvideo-container relative aspect-video bg-black rounded-[var(--radius-2xl)] group ${data.fullscreenMode === 'window' ? 'is-web-fullscreen' : ''
        } ${shouldForceLandscape ? 'force-landscape' : ''}`}
      style={webFullscreenStyle}
      onMouseMove={() => { handleMouseMove(); }}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div className={stageClassName}>
        {/* Clipping Wrapper for video and overlays - Restores the 'Liquid Glass' rounded look */}
        <div className={`absolute inset-0 overflow-hidden pointer-events-none ${data.fullscreenMode === 'window' ? 'rounded-0' : 'rounded-[var(--radius-2xl)]'
          }`}>
          <div className="absolute inset-0 pointer-events-auto">
          {/* Video Element */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            poster={poster}
            x-webkit-airplay="allow"
            playsInline={true} // Crucial for iOS custom fullscreen to work without native player taking over
            controls={false} // Explicitly disable native controls
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdateEvent}
            onLoadedMetadata={handleLoadedMetadata}
            onProgress={handleProgressEvent}
            onError={handleVideoError}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            onClick={!isMobile ? () => {
              togglePlay();
            } : undefined}
            onTouchStart={isMobile ? handleTap : undefined}
            {...LEGACY_INLINE_VIDEO_PROPS} // Legacy iOS support
          />

          {/* Danmaku Canvas */}
          {danmakuEnabled && danmakuComments.length > 0 && (
            <DanmakuCanvas
              comments={danmakuComments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              duration={duration}
            />
          )}

          {/* Video Resolution Badge - follows controls bar visibility */}
          {videoResolution && (
            <div className={`absolute top-3 left-3 z-20 pointer-events-none transition-opacity duration-300 ${data.showControls ? 'opacity-80' : 'opacity-0'}`}>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${videoResolution.color}`}>
                {videoResolution.label}
                <span className="font-normal opacity-80">{videoResolution.width}x{videoResolution.height}</span>
              </span>
            </div>
          )}

          <DesktopOverlayWrapper
            data={data}
            showControls={data.showControls}
            isFullscreen={data.isFullscreen}
            fullscreenClock={fullscreenClock}
            isRotated={shouldForceLandscape}
            onTogglePlay={togglePlay}
            onSkipForward={logic.skipForward}
            onSkipBackward={logic.skipBackward}
            isTransitioningToNextEpisode={isTransitioningToNextEpisode}
            // More Menu Props
            showMoreMenu={data.showMoreMenu}
            isPremium={isPremium}
            isProxied={src.includes('/api/proxy')}
            onToggleMoreMenu={() => actions.setShowMoreMenu(!data.showMoreMenu)}
            onMoreMenuMouseEnter={() => {
              if (moreMenuTimeoutRef.current) {
                clearTimeout(moreMenuTimeoutRef.current);
                moreMenuTimeoutRef.current = null;
              }
            }}
            onMoreMenuMouseLeave={() => {
              if (moreMenuTimeoutRef.current) {
                clearTimeout(moreMenuTimeoutRef.current);
              }
              moreMenuTimeoutRef.current = setTimeout(() => {
                actions.setShowMoreMenu(false);
                moreMenuTimeoutRef.current = null;
              }, 800); // Increased timeout for better stability
            }}
            onCopyLink={logic.handleCopyLink}
            seekStepSeconds={seekStepSeconds}
            // Speed Menu Props
            playbackRate={data.playbackRate}
            showSpeedMenu={data.showSpeedMenu}
            speeds={[0.5, 0.75, 1, 1.25, 1.5, 2]}
            onToggleSpeedMenu={() => actions.setShowSpeedMenu(!data.showSpeedMenu)}
            onSpeedChange={logic.changePlaybackSpeed}
            onSpeedMenuMouseEnter={logic.clearSpeedMenuTimeout}
            onSpeedMenuMouseLeave={logic.startSpeedMenuTimeout}
            webFullscreenSize={webFullscreenSize}
            onCycleWebFullscreenSize={cycleWebFullscreenSize}
            // Portal container
            containerRef={containerRef}
          />

            <DesktopControlsWrapper
              src={src}
              data={data}
              logic={logic}
              refs={refs}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
