'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useHistory } from '@/lib/store/history-store';
import { settingsStore } from '@/lib/store/settings-store';
import { premiumModeSettingsStore } from '@/lib/store/premium-mode-settings';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { VideoPlayerError } from './VideoPlayerError';
import { VideoPlayerEmpty } from './VideoPlayerEmpty';

interface VideoPlayerProps {
  playUrl: string;
  videoId?: string;
  currentEpisode: number;
  onBack: () => void;
  // Episode navigation props for auto-skip/auto-next
  totalEpisodes?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  isPremium?: boolean;
  // Danmaku props
  videoTitle?: string;
  episodeName?: string;
  // Expose current time to parent
  externalTimeRef?: React.MutableRefObject<number>;
  // Resolution callback
  onResolutionDetected?: (info: import('./hooks/useVideoResolution').VideoResolutionInfo) => void;
}

export function VideoPlayer({
  playUrl,
  videoId,
  currentEpisode,
  onBack,
  totalEpisodes,
  onNextEpisode,
  isReversed = false,
  isPremium = false,
  videoTitle,
  episodeName,
  externalTimeRef,
  onResolutionDetected,
}: VideoPlayerProps) {
  const [videoError, setVideoError] = useState<string>('');
  const [useProxy, setUseProxy] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_MANUAL_RETRIES = 20;
  const lastSaveTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const SAVE_INTERVAL = 5000; // 5 seconds throttle

  // Get showModeIndicator setting
  // Get showModeIndicator and proxyMode settings
  const [showModeIndicator, setShowModeIndicator] = useState(false);
  const [proxyMode, setProxyMode] = useState<'retry' | 'none' | 'always'>('retry');

  useEffect(() => {
    // Initial value - use mode-specific store
    const store = isPremium ? premiumModeSettingsStore : settingsStore;
    const settings = store.getSettings();
    setShowModeIndicator(settings.showModeIndicator);
    setProxyMode(settings.proxyMode);

    // Subscribe to changes
    const unsubscribe = store.subscribe(() => {
      const newSettings = store.getSettings();
      setShowModeIndicator(newSettings.showModeIndicator);
      setProxyMode(newSettings.proxyMode);
    });

    return () => unsubscribe();
  }, []);

  // Initialize useProxy based on proxyMode when the component mounts or proxyMode changes
  // We use a separate effect for this to react to setting changes
  useEffect(() => {
    if (proxyMode === 'always') {
      setUseProxy(true);
    } else if (proxyMode === 'none') {
      setUseProxy(false);
    }
    // For 'retry', we assume it starts as false (direct), which is the default state of useProxy
  }, [proxyMode]);


  // Use reactive hook to subscribe to history updates
  // This ensures the component re-renders when history is hydrated from localStorage
  const { viewingHistory, addToHistory } = useHistory(isPremium);
  const searchParams = useSearchParams();

  // Get video metadata from URL params
  const source = searchParams.get('source') || '';
  const title = searchParams.get('title') || '未知视频';

  // Get saved progress for this video
  const getSavedProgress = () => {
    // Check for explicit time parameter (from source switch)
    const timeParam = searchParams.get('t');
    if (timeParam) {
      const t = parseFloat(timeParam);
      if (t > 0 && isFinite(t)) return t;
    }

    if (!videoId) return 0;

    // Match by normalized title + episode index (source-agnostic)
    const normalizedTitle = title.toLowerCase().trim();
    const historyItem = viewingHistory.find(item =>
      item.title.toLowerCase().trim() === normalizedTitle &&
      item.episodeIndex === currentEpisode
    );

    return historyItem ? historyItem.playbackPosition : 0;
  };

  // Save progress function (used by throttle and beforeunload)
  const saveProgress = useCallback((currentTime: number, duration: number) => {
    if (!videoId || !playUrl || duration === 0 || currentTime <= 1) return;
    addToHistory(
      videoId,
      title,
      playUrl,
      currentEpisode,
      source,
      currentTime,
      duration,
      undefined,
      []
    );
  }, [videoId, playUrl, title, currentEpisode, source, addToHistory]);

  // Handle time updates and save progress (throttled to every 5 seconds)
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    // Always track current time for beforeunload
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    // Expose to parent for source switching
    if (externalTimeRef) externalTimeRef.current = currentTime;

    if (!videoId || !playUrl || duration === 0) return;

    const now = Date.now();
    // Only save if enough time has passed since last save
    if (currentTime > 1 && now - lastSaveTimeRef.current >= SAVE_INTERVAL) {
      lastSaveTimeRef.current = now;
      saveProgress(currentTime, duration);
    }
  }, [videoId, playUrl, saveProgress]);

  // Save on page leave/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save current progress before leaving
      if (currentTimeRef.current > 1 && durationRef.current > 0) {
        saveProgress(currentTimeRef.current, durationRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);

  // Handle video errors
  const handleVideoError = (error: string) => {
    console.error('Video playback error:', error);

    // Auto-retry with proxy if:
    // 1. Not already using proxy
    // 2. Proxy mode is NOT 'none' (so 'retry' or potentially 'always' if it somehow failed locally)
    // 3. Proxy mode is 'retry' (specifically for the auto-switch logic)
    // Note: If mode is 'always', we are already using proxy. If it fails, we show error.

    if (!useProxy && proxyMode === 'retry') {
      setUseProxy(true);
      setShouldAutoPlay(true); // Force autoplay after proxy retry
      setVideoError('');
      return;
    }

    setVideoError(error);
  };

  const handleRetry = () => {
    if (retryCount >= MAX_MANUAL_RETRIES) return;

    setRetryCount(prev => prev + 1);
    setVideoError('');
    setShouldAutoPlay(true);
    // Toggle proxy to try different path, but since we are already in error state which likely means proxy failed (or direct failed),
    // we can try toggling or just force re-render.
    // Requirement says: "try without proxy and proxy and same as before"
    // We will just toggle useProxy state to force a refresh with/without proxy.
    // However, if we want to cycle, we can just toggle.
    // But the requirement says "proxy attempt count to 20".
    // So we just increment count and maybe toggle proxy or keep it.
    // Let's toggle it to give best chance.
    // Actually requirement says "try no proxy and proxy and same as before".
    // So simple toggle is fine.
    setUseProxy(prev => !prev);
  };

  const finalPlayUrl = useProxy || proxyMode === 'always'
    ? `/api/proxy?url=${encodeURIComponent(playUrl)}&retry=${retryCount}` // Add retry param to force fresh request
    : playUrl;

  if (!playUrl) {
    return <VideoPlayerEmpty />;
  }

  return (
    <div data-no-spatial>
    <Card hover={false} className="p-0 relative">
      {/* Mode Indicator Badge - controlled by settings */}
      {showModeIndicator && (
        <div className="absolute top-3 right-3 z-30">
          <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-md transition-all duration-300 ${useProxy
            ? 'bg-orange-500/80 text-white'
            : 'bg-green-500/80 text-white'
            }`}>
            {useProxy ? '代理模式' : '直连模式'}
          </span>
        </div>
      )}
      {videoError ? (
        <VideoPlayerError
          error={videoError}
          onBack={onBack}
          onRetry={handleRetry}
          retryCount={retryCount}
          maxRetries={MAX_MANUAL_RETRIES}
        />
      ) : (
        <CustomVideoPlayer
          key={`${useProxy ? 'proxy' : 'direct'}-${retryCount}-${source}`} // Remount when switching sources, modes, or retrying
          src={finalPlayUrl}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          initialTime={getSavedProgress()}
          shouldAutoPlay={shouldAutoPlay}
          totalEpisodes={totalEpisodes}
          currentEpisodeIndex={currentEpisode}
          onNextEpisode={onNextEpisode}
          isReversed={isReversed}
          videoTitle={videoTitle}
          episodeName={episodeName}
          onResolutionDetected={onResolutionDetected}
        />
      )}
    </Card>
    </div>
  );
}
