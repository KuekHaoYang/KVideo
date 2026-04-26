/**
 * Resolution Badge Auto-Hide Hook
 * Shows the resolution badge when detected, then auto-hides after a delay.
 * Reappears briefly on user interaction (mouse move / touch).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VideoResolutionInfo } from './useVideoResolution';

const AUTO_HIDE_DELAY = 5000; // 5 seconds

export function useResolutionBadge(resolution: VideoResolutionInfo | null) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_DELAY);
  }, [clearTimer]);

  // Show badge when resolution first detected or changes
  useEffect(() => {
    let frameId: number | null = null;

    if (resolution) {
      frameId = window.requestAnimationFrame(() => {
        setVisible(true);
        startHideTimer();
      });
    } else {
      clearTimer();
      frameId = window.requestAnimationFrame(() => {
        setVisible(false);
      });
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [resolution, startHideTimer, clearTimer]);

  // Briefly show badge on user interaction
  const flashBadge = useCallback(() => {
    if (!resolution) return;
    setVisible(true);
    startHideTimer();
  }, [resolution, startHideTimer]);

  // Cleanup
  useEffect(() => clearTimer, [clearTimer]);

  return { badgeVisible: visible, flashBadge };
}
