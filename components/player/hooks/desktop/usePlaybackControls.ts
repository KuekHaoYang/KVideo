import { useCallback, useEffect, useMemo } from 'react';
import { formatTime } from '@/lib/utils/format-utils';
import { usePlaybackPolling } from '../usePlaybackPolling';

interface UsePlaybackControlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    initialTime: number;
    shouldAutoPlay: boolean;
    setDuration: (duration: number) => void;
    setCurrentTime: (time: number) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onError?: (error: string) => void;
    isDraggingProgressRef: React.MutableRefObject<boolean>;
    speedMenuTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    playbackRate: number;
    setPlaybackRate: (rate: number) => void;
    setShowSpeedMenu: (show: boolean) => void;
    volume: number;
    isMuted: boolean;
}

export function usePlaybackControls({
    videoRef,
    isPlaying,
    setIsPlaying,
    setIsLoading,
    initialTime,
    shouldAutoPlay,
    setDuration,
    setCurrentTime,
    onTimeUpdate,
    onError,
    isDraggingProgressRef,
    speedMenuTimeoutRef,
    playbackRate,
    setPlaybackRate,
    setShowSpeedMenu,
    volume,
    isMuted
}: UsePlaybackControlsProps) {
    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Ignore AbortError: The play() request was interrupted by a call to pause().
                    if (error.name !== 'AbortError') {
                        console.error('Playback failed:', error);
                    }
                });
            }
        }
    }, [isPlaying, videoRef]);

    const handlePlay = useCallback(() => setIsPlaying(true), [setIsPlaying]);
    const handlePause = useCallback(() => setIsPlaying(false), [setIsPlaying]);

    const handleTimeUpdateEvent = useCallback(() => {
        if (!videoRef.current || isDraggingProgressRef.current) return;
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        setCurrentTime(current);
        setDuration(total);
        if (onTimeUpdate) {
            onTimeUpdate(current, total);
        }
    }, [videoRef, isDraggingProgressRef, setCurrentTime, setDuration, onTimeUpdate]);

    const handleLoadedMetadata = useCallback(() => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
        // Removed setIsLoading(false) because metadata loading is too early.
        // We wait for onCanPlay to set isLoading to false.

        // Fix for stuck at 00:00:00:
        // Only seek if we are at the very start (to avoid overwriting a previous seek)
        if (videoRef.current.currentTime < 0.5) {
            // If initialTime is 0, we seek to a tiny offset to help the browser/HLS buffer start.
            const startPosition = initialTime > 0 ? initialTime : 0.1;
            videoRef.current.currentTime = startPosition;
        }

        // Apply saved playback rate when new source loads (for episode changes)
        if (playbackRate !== 1 && videoRef.current.playbackRate !== playbackRate) {
            videoRef.current.playbackRate = playbackRate;
        }

        // Apply saved volume and mute state when new source loads
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.muted = isMuted;

        videoRef.current.play().catch((err: Error) => {
            console.warn('Autoplay was prevented:', err);
        });
    }, [videoRef, setDuration, setIsLoading, initialTime, playbackRate, volume, isMuted]);

    // Handle late initialization of initialTime (e.g. from async storage hydration)
    useEffect(() => {
        if (initialTime > 0 && videoRef.current) {
            // Only seek if we haven't progressed far (e.g. still near start)
            // AND if the target time is significantly different from current time (> 0.5s)
            // This prevents jumping if the user has already started watching and initialTime updates
            if (videoRef.current.currentTime < 2 && Math.abs(videoRef.current.currentTime - initialTime) > 0.5) {
                videoRef.current.currentTime = initialTime;
            }
        }
    }, [initialTime, videoRef]);

    // Force autoplay when shouldAutoPlay is true (for proxy retry)
    useEffect(() => {
        if (shouldAutoPlay && videoRef.current) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch((err: Error) => {
                    console.warn('Force autoplay was prevented:', err);
                });
            }
        }
    }, [shouldAutoPlay, videoRef]);

    const handleVideoError = useCallback(() => {
        setIsLoading(false);
        if (onError) {
            onError('Video failed to load');
        }
    }, [setIsLoading, onError]);

    const changePlaybackSpeed = useCallback((speed: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = speed;
        setPlaybackRate(speed);
        // Persist playback rate to localStorage
        localStorage.setItem('kvideo-playback-rate', speed.toString());
        setShowSpeedMenu(false);
        if (speedMenuTimeoutRef.current) {
            clearTimeout(speedMenuTimeoutRef.current);
        }
    }, [videoRef, setPlaybackRate, setShowSpeedMenu, speedMenuTimeoutRef]);

    // Polling fallback for AirPlay and throttled events
    usePlaybackPolling({
        isPlaying,
        videoRef,
        isDraggingProgressRef,
        setCurrentTime,
        setDuration,
        setIsPlaying
    });

    const playbackActions = useMemo(() => ({
        togglePlay,
        handlePlay,
        handlePause,
        handleTimeUpdateEvent,
        handleLoadedMetadata,
        handleVideoError,
        changePlaybackSpeed,
        formatTime
    }), [
        togglePlay,
        handlePlay,
        handlePause,
        handleTimeUpdateEvent,
        handleLoadedMetadata,
        handleVideoError,
        changePlaybackSpeed
    ]);

    return playbackActions;
}
