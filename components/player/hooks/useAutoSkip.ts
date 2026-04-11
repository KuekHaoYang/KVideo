'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerSettings } from './usePlayerSettings';

interface UseAutoSkipProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isPremium?: boolean;
    totalEpisodes?: number;
    currentEpisodeIndex?: number;
    onNextEpisode?: () => void;
    isReversed?: boolean;
}

/**
 * Hook to handle auto-skip intro/outro and auto-next episode logic
 * 
 * Skip intro: When currentTime < skipIntroSeconds, seek to skipIntroSeconds
 * Skip outro: When (duration - currentTime) <= skipOutroSeconds, trigger next episode
 * Auto next: When video ends, auto-advance to next episode if enabled
 */
export function useAutoSkip({
    videoRef,
    currentTime,
    duration,
    isPlaying,
    isPremium = false,
    totalEpisodes = 1,
    currentEpisodeIndex = 0,
    onNextEpisode,
    isReversed = false,
    src,
}: UseAutoSkipProps) {
    const {
        autoNextEpisode,
        autoSkipIntro,
        skipIntroSeconds,
        autoSkipOutro,
        skipOutroSeconds,
    } = usePlayerSettings(isPremium);

    // Track if we've already skipped intro for this video session
    const hasSkippedIntroRef = useRef(false);
    // Track if we've already handled navigation for this specific source
    const lastHandledSrcRef = useRef<string>('');
    // Track if we've triggered outro skip to prevent multiple triggers within the same video session
    const hasTriggeredOutroSkipRef = useRef(false);
    // Track if we're currently in the outro zone for UI purposes
    const [isOutroActive, setIsOutroActive] = useState(false);
    // Track if we're transitioning to next episode (for custom loading indicator)
    const [isTransitioningToNextEpisode, setIsTransitioningToNextEpisode] = useState(false);

    // Reset flags when video source changes
    useEffect(() => {
        hasSkippedIntroRef.current = false;
        hasTriggeredOutroSkipRef.current = false;
        setIsOutroActive(false);
        // Note: isTransitioningToNextEpisode is NOT reset here immediately
        // because we want it to persist while the next episode is loading.
        // It will be reset via the 'canplay' event below.
    }, [src, videoRef]);

    // Handle resetting transition state when video is ready
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleReady = () => {
            setIsTransitioningToNextEpisode(false);
        };

        video.addEventListener('canplay', handleReady);
        video.addEventListener('playing', handleReady);
        return () => {
            video.removeEventListener('canplay', handleReady);
            video.removeEventListener('playing', handleReady);
        };
    }, [videoRef]);

    // Check if we can advance to next episode
    const canAdvanceToNext = useCallback(() => {
        if (totalEpisodes <= 1) return false;

        const nextEpisodeFn = onNextEpisodeRef.current;

        if (!isReversed) {
            // Normal order: next is index + 1
            return currentEpisodeIndex < totalEpisodes - 1 && !!nextEpisodeFn;
        } else {
            // Reversed order: next is index - 1 (since we're going backwards)
            return currentEpisodeIndex > 0 && !!nextEpisodeFn;
        }
    }, [totalEpisodes, currentEpisodeIndex, isReversed]);


    // Keep a stable ref to onNextEpisode to avoid effect re-runs
    const onNextEpisodeRef = useRef(onNextEpisode);
    useEffect(() => {
        onNextEpisodeRef.current = onNextEpisode;
    }, [onNextEpisode]);

    // Helper to trigger next episode exactly once per source
    const triggerNextEpisode = useCallback((reason: string) => {
        if (!onNextEpisodeRef.current) return;

        // Prevent double trigger for the same source URL
        if (lastHandledSrcRef.current === src) {
            console.log(`[AutoSkip] Ignoring ${reason} trigger: already handled for this source`);
            return;
        }

        // Safety check: if we are already transitioning, do not trigger again
        // This is a critical guard against infinite loops where the trigger might be called repeatedly
        // before the parent component has a chance to unmount or change the source.
        if (isTransitioningToNextEpisode) {
            console.log(`[AutoSkip] Ignoring ${reason} trigger: already transitioning`);
            return;
        }

        console.log(`[AutoSkip] Triggering next episode via ${reason}`);
        lastHandledSrcRef.current = src;
        // Set transitioning state for custom loading indicator
        setIsTransitioningToNextEpisode(true);
        onNextEpisodeRef.current();
    }, [src, isTransitioningToNextEpisode]);

    // Validate that duration is ready (not 0, NaN, or Infinity)
    const isDurationValid = useCallback(() => {
        return duration > 0 && !isNaN(duration) && isFinite(duration);
    }, [duration]);

    // Validate current time is valid
    const isTimeValid = useCallback(() => {
        return !isNaN(currentTime) && isFinite(currentTime);
    }, [currentTime]);

    // Handle intro skip
    const attemptIntroSkip = useCallback(() => {
        if (!autoSkipIntro || skipIntroSeconds <= 0) return;
        if (!isDurationValid() || !isTimeValid()) return;
        if (hasSkippedIntroRef.current) return;

        const video = videoRef.current;
        if (!video) return;

        // Only skip if we're in the intro zone (between 0 and skipIntroSeconds)
        if (currentTime >= 0 && currentTime < skipIntroSeconds && currentTime < duration) {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
                console.log(`[AutoSkip] Jumping from ${currentTime}s to intro skip point ${skipIntroSeconds}s`);
                video.currentTime = Math.min(skipIntroSeconds, duration - 1);
                hasSkippedIntroRef.current = true;
            }
        }
    }, [autoSkipIntro, skipIntroSeconds, currentTime, duration, isDurationValid, isTimeValid, videoRef]);

    // React to time changes for intro skip
    useEffect(() => {
        attemptIntroSkip();
    }, [attemptIntroSkip]);

    // Also react to video getting ready for intro skip
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleReady = () => {
            if (!hasSkippedIntroRef.current) {
                attemptIntroSkip();
            }
        };

        video.addEventListener('canplay', handleReady);
        video.addEventListener('loadedmetadata', handleReady);
        return () => {
            video.removeEventListener('canplay', handleReady);
            video.removeEventListener('loadedmetadata', handleReady);
        };
    }, [videoRef, attemptIntroSkip]);

    // Handle outro skip (based on remaining time)
    useEffect(() => {
        if (!autoSkipOutro || skipOutroSeconds <= 0) {
            setIsOutroActive(false);
            return;
        }
        if (!isDurationValid() || !isTimeValid()) return;
        if (hasTriggeredOutroSkipRef.current) return;

        const remainingTime = duration - currentTime;

        // Check if we're in the outro zone
        const inOutroZone = remainingTime > 0 && remainingTime <= skipOutroSeconds && currentTime > 0;

        if (inOutroZone) {
            setIsOutroActive(true);

            // Only auto-trigger if video is actually playing
            if (isPlaying) {
                console.log(`[AutoSkip] Outro detected: ${remainingTime.toFixed(1)}s remaining`);
                hasTriggeredOutroSkipRef.current = true;

                // If we can advance to next episode, do it
                if (autoNextEpisode && canAdvanceToNext()) {
                    triggerNextEpisode('outro-timer');
                } else {
                    // Otherwise just seek to end to trigger ended event
                    const video = videoRef.current;
                    if (video) {
                        console.log('[AutoSkip] No next episode, seeking to end');
                        video.currentTime = duration;
                    }
                }
            }
        } else {
            setIsOutroActive(false);
        }
    }, [autoSkipOutro, skipOutroSeconds, currentTime, duration, isPlaying, isDurationValid, isTimeValid, autoNextEpisode, canAdvanceToNext, triggerNextEpisode, videoRef]);

    // Handle video ended event for auto-next
    const handleVideoEnded = useCallback(() => {
        console.log(`[AutoSkip] Video ended naturally`);
        if (!autoNextEpisode) return;
        if (!canAdvanceToNext()) return;
        if (hasTriggeredOutroSkipRef.current) return;

        // Slight delay to ensure clean transition
        setTimeout(() => {
            triggerNextEpisode('ended-event');
        }, 100);
    }, [autoNextEpisode, canAdvanceToNext, triggerNextEpisode]);

    // Attach ended event listener
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.addEventListener('ended', handleVideoEnded);
        return () => video.removeEventListener('ended', handleVideoEnded);
    }, [videoRef, handleVideoEnded]);

    return {
        hasSkippedIntro: hasSkippedIntroRef.current,
        hasTriggeredOutroSkip: hasTriggeredOutroSkipRef.current,
        isOutroActive,
        isTransitioningToNextEpisode,
    };
}
