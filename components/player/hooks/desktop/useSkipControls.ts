import { useCallback, useMemo } from 'react';

interface UseSkipControlsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    duration: number;
    seekStepSeconds: number;
    setCurrentTime: (time: number) => void;
    showSkipForwardIndicator: boolean;
    showSkipBackwardIndicator: boolean;
    skipForwardAmount: number;
    skipBackwardAmount: number;
    setShowSkipForwardIndicator: (show: boolean) => void;
    setShowSkipBackwardIndicator: (show: boolean) => void;
    setSkipForwardAmount: (amount: number) => void;
    setSkipBackwardAmount: (amount: number) => void;
    setIsSkipForwardAnimatingOut: (animating: boolean) => void;
    setIsSkipBackwardAnimatingOut: (animating: boolean) => void;
    skipForwardTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
    skipBackwardTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useSkipControls({
    videoRef,
    duration,
    seekStepSeconds,
    setCurrentTime,
    showSkipForwardIndicator,
    showSkipBackwardIndicator,
    skipForwardAmount,
    skipBackwardAmount,
    setShowSkipForwardIndicator,
    setShowSkipBackwardIndicator,
    setSkipForwardAmount,
    setSkipBackwardAmount,
    setIsSkipForwardAnimatingOut,
    setIsSkipBackwardAnimatingOut,
    skipForwardTimeoutRef,
    skipBackwardTimeoutRef
}: UseSkipControlsProps) {
    const skipForward = useCallback(() => {
        if (!videoRef.current) return;

        setShowSkipBackwardIndicator(false);
        setSkipBackwardAmount(0);
        setIsSkipBackwardAnimatingOut(false);
        if (skipBackwardTimeoutRef.current) {
            clearTimeout(skipBackwardTimeoutRef.current);
        }

        if (skipForwardTimeoutRef.current) {
            clearTimeout(skipForwardTimeoutRef.current);
        }

        const newSkipAmount = showSkipForwardIndicator ? skipForwardAmount + seekStepSeconds : seekStepSeconds;
        setSkipForwardAmount(newSkipAmount);
        setShowSkipForwardIndicator(true);
        setIsSkipForwardAnimatingOut(false);

        const targetTime = Math.min(videoRef.current.currentTime + seekStepSeconds, duration);
        videoRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);

        skipForwardTimeoutRef.current = setTimeout(() => {
            setIsSkipForwardAnimatingOut(true);
            setTimeout(() => {
                setShowSkipForwardIndicator(false);
                setSkipForwardAmount(0);
                setIsSkipForwardAnimatingOut(false);
            }, 200);
        }, 800);
    }, [videoRef, duration, seekStepSeconds, showSkipForwardIndicator, skipForwardAmount, skipBackwardTimeoutRef, skipForwardTimeoutRef, setShowSkipBackwardIndicator, setSkipBackwardAmount, setIsSkipBackwardAnimatingOut, setSkipForwardAmount, setShowSkipForwardIndicator, setIsSkipForwardAnimatingOut, setCurrentTime]);

    const skipBackward = useCallback(() => {
        if (!videoRef.current) return;

        setShowSkipForwardIndicator(false);
        setSkipForwardAmount(0);
        setIsSkipForwardAnimatingOut(false);
        if (skipForwardTimeoutRef.current) {
            clearTimeout(skipForwardTimeoutRef.current);
        }

        if (skipBackwardTimeoutRef.current) {
            clearTimeout(skipBackwardTimeoutRef.current);
        }

        const newSkipAmount = showSkipBackwardIndicator ? skipBackwardAmount + seekStepSeconds : seekStepSeconds;
        setSkipBackwardAmount(newSkipAmount);
        setShowSkipBackwardIndicator(true);
        setIsSkipBackwardAnimatingOut(false);

        const targetTime = Math.max(videoRef.current.currentTime - seekStepSeconds, 0);
        videoRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);

        skipBackwardTimeoutRef.current = setTimeout(() => {
            setIsSkipBackwardAnimatingOut(true);
            setTimeout(() => {
                setShowSkipBackwardIndicator(false);
                setSkipBackwardAmount(0);
                setIsSkipBackwardAnimatingOut(false);
            }, 200);
        }, 800);
    }, [videoRef, seekStepSeconds, showSkipBackwardIndicator, skipBackwardAmount, skipForwardTimeoutRef, skipBackwardTimeoutRef, setShowSkipForwardIndicator, setSkipForwardAmount, setIsSkipForwardAnimatingOut, setSkipBackwardAmount, setShowSkipBackwardIndicator, setIsSkipBackwardAnimatingOut, setCurrentTime]);

    const skipActions = useMemo(() => ({
        skipForward,
        skipBackward
    }), [skipForward, skipBackward]);

    return skipActions;
}
