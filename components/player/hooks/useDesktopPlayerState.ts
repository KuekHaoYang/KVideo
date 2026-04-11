import { useState, useRef, useMemo } from 'react';

export type FullscreenMode = 'none' | 'native' | 'window';

export function useDesktopPlayerState() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);
    const volumeBarRef = useRef<HTMLDivElement>(null);

    // Refs for timeouts and tracking
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const speedMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const skipForwardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const skipBackwardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const volumeBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingProgressRef = useRef(false);
    const isDraggingVolumeRef = useRef(false);
    const mouseMoveThrottleRef = useRef<NodeJS.Timeout | null>(null);
    const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const moreMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [bufferedTime, setBufferedTime] = useState(0);
    const [volume, setVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kvideo-volume');
            return saved ? parseFloat(saved) : 1;
        }
        return 1;
    });
    const [isMuted, setIsMuted] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('kvideo-muted') === 'true';
        }
        return false;
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('none');
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('kvideo-playback-rate');
            return saved ? parseFloat(saved) : 1;
        }
        return 1;
    });
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [isPiPSupported, setIsPiPSupported] = useState(false);
    const [isAirPlaySupported, setIsAirPlaySupported] = useState(false);
    const [isCastAvailable, setIsCastAvailable] = useState(false);
    const [isCasting, setIsCasting] = useState(false);
    const [skipForwardAmount, setSkipForwardAmount] = useState(0);
    const [skipBackwardAmount, setSkipBackwardAmount] = useState(0);
    const [showSkipForwardIndicator, setShowSkipForwardIndicator] = useState(false);
    const [showSkipBackwardIndicator, setShowSkipBackwardIndicator] = useState(false);
    const [isSkipForwardAnimatingOut, setIsSkipForwardAnimatingOut] = useState(false);
    const [isSkipBackwardAnimatingOut, setIsSkipBackwardAnimatingOut] = useState(false);
    const [showVolumeBar, setShowVolumeBar] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const refs = useMemo(() => ({
        videoRef,
        containerRef,
        progressBarRef,
        volumeBarRef,
        controlsTimeoutRef,
        speedMenuTimeoutRef,
        skipForwardTimeoutRef,
        skipBackwardTimeoutRef,
        volumeBarTimeoutRef,
        isDraggingProgressRef,
        isDraggingVolumeRef,
        mouseMoveThrottleRef,
        toastTimeoutRef,
        moreMenuTimeoutRef
    }), []); // Refs never change after creation

    const data = useMemo(() => ({
        isPlaying,
        currentTime,
        duration,
        bufferedTime,
        volume,
        isMuted,
        isFullscreen,
        fullscreenMode,
        showControls,
        isLoading,
        playbackRate,
        showSpeedMenu,
        isPiPSupported,
        isAirPlaySupported,
        isCastAvailable,
        isCasting,
        skipForwardAmount,
        skipBackwardAmount,
        showSkipForwardIndicator,
        showSkipBackwardIndicator,
        isSkipForwardAnimatingOut,
        isSkipBackwardAnimatingOut,
        showVolumeBar,
        toastMessage,
        showToast,
        showMoreMenu
    }), [
        isPlaying, currentTime, duration, bufferedTime, volume, isMuted, isFullscreen, fullscreenMode,
        showControls, isLoading, playbackRate, showSpeedMenu, isPiPSupported,
        isAirPlaySupported, isCastAvailable, isCasting, skipForwardAmount,
        skipBackwardAmount, showSkipForwardIndicator, showSkipBackwardIndicator,
        isSkipForwardAnimatingOut, isSkipBackwardAnimatingOut, showVolumeBar,
        toastMessage, showToast, showMoreMenu
    ]);

    const actions = useMemo(() => ({
        setIsPlaying,
        setCurrentTime,
        setDuration,
        setBufferedTime,
        setVolume,
        setIsMuted,
        setIsFullscreen,
        setFullscreenMode,
        setShowControls,
        setIsLoading,
        setPlaybackRate,
        setShowSpeedMenu,
        setIsPiPSupported,
        setIsAirPlaySupported,
        setIsCastAvailable,
        setIsCasting,
        setSkipForwardAmount,
        setSkipBackwardAmount,
        setShowSkipForwardIndicator,
        setShowSkipBackwardIndicator,
        setIsSkipForwardAnimatingOut,
        setIsSkipBackwardAnimatingOut,
        setShowVolumeBar,
        setToastMessage,
        setShowToast,
        setShowMoreMenu
    }), []); // All setters from useState are stable

    return { refs, data, actions };
}
