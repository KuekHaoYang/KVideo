import { useEffect, useCallback, useMemo } from 'react';

interface UseControlsVisibilityProps {
    isPlaying: boolean;
    showControls: boolean;
    showSpeedMenu: boolean;
    showMoreMenu: boolean;
    setShowControls: (show: boolean) => void;
    setShowSpeedMenu: (show: boolean) => void;
    setShowMoreMenu: (show: boolean) => void;
    controlsTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    speedMenuTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    mouseMoveThrottleRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useControlsVisibility({
    isPlaying,
    showControls,
    showSpeedMenu,
    showMoreMenu,
    setShowControls,
    setShowSpeedMenu,
    setShowMoreMenu,
    controlsTimeoutRef,
    speedMenuTimeoutRef,
    mouseMoveThrottleRef
}: UseControlsVisibilityProps) {
    // Shared hide controls logic
    const hideControls = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && !showSpeedMenu && !showMoreMenu) {
                setShowControls(false);
            }
        }, 3000);
    }, [isPlaying, showSpeedMenu, showMoreMenu, setShowControls, controlsTimeoutRef]);

    // Force controls to show when paused
    useEffect(() => {
        if (!isPlaying) {
            setShowControls(true);
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        } else {
            // When resuming play, start the timer to hide controls
            hideControls();
        }
    }, [isPlaying, setShowControls, hideControls, controlsTimeoutRef]);

    useEffect(() => {
        if (!isPlaying || showSpeedMenu || showMoreMenu) {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            return;
        }

        hideControls();

        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [isPlaying, showSpeedMenu, setShowControls, controlsTimeoutRef]);

    const handleMouseMove = useCallback(() => {
        if (mouseMoveThrottleRef.current) return;

        mouseMoveThrottleRef.current = setTimeout(() => {
            mouseMoveThrottleRef.current = null;
        }, 200);

        if (!showControls) {
            setShowControls(true);
        }
        if (isPlaying && controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }
    }, [showControls, isPlaying, setShowControls, controlsTimeoutRef, mouseMoveThrottleRef]);

    const startSpeedMenuTimeout = useCallback(() => {
        if (speedMenuTimeoutRef.current) {
            clearTimeout(speedMenuTimeoutRef.current);
        }
        speedMenuTimeoutRef.current = setTimeout(() => {
            setShowSpeedMenu(false);
        }, 1500);
    }, [speedMenuTimeoutRef, setShowSpeedMenu]);

    const clearSpeedMenuTimeout = useCallback(() => {
        if (speedMenuTimeoutRef.current) {
            clearTimeout(speedMenuTimeoutRef.current);
        }
    }, [speedMenuTimeoutRef]);

    useEffect(() => {
        if (showSpeedMenu) {
            startSpeedMenuTimeout();
        } else {
            clearSpeedMenuTimeout();
        }
        return () => clearSpeedMenuTimeout();
    }, [showSpeedMenu, startSpeedMenuTimeout, clearSpeedMenuTimeout]);

    const handleTouchToggleControls = useCallback(() => {
        if (showControls && isPlaying) {
            // Controls visible + playing = hide immediately
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            setShowControls(false);
        } else if (!showControls) {
            // Controls hidden = show + start 3s auto-hide timer
            setShowControls(true);
            if (isPlaying) {
                if (controlsTimeoutRef.current) {
                    clearTimeout(controlsTimeoutRef.current);
                }
                controlsTimeoutRef.current = setTimeout(() => {
                    setShowControls(false);
                }, 3000);
            }
        }
    }, [showControls, isPlaying, setShowControls, controlsTimeoutRef]);

    const visibilityActions = useMemo(() => ({
        handleMouseMove,
        handleTouchToggleControls,
        startSpeedMenuTimeout,
        clearSpeedMenuTimeout
    }), [handleMouseMove, handleTouchToggleControls, startSpeedMenuTimeout, clearSpeedMenuTimeout]);

    return visibilityActions;
}
