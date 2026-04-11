import { useMemo } from 'react';
import { usePlaybackControls } from './desktop/usePlaybackControls';
import { useVolumeControls } from './desktop/useVolumeControls';
import { useProgressControls } from './desktop/useProgressControls';
import { useSkipControls } from './desktop/useSkipControls';
import { useFullscreenControls } from './desktop/useFullscreenControls';
import { useControlsVisibility } from './desktop/useControlsVisibility';
import { useUtilities } from './desktop/useUtilities';
import { useDesktopShortcuts } from './desktop/useDesktopShortcuts';
import { useDesktopPlayerState } from './useDesktopPlayerState';
import { getCopyUrl } from '../utils/urlUtils';
import { useCastControls } from './desktop/useCastControls';
import { DEFAULT_SEEK_STEP_SECONDS } from '@/lib/store/settings-store';

type DesktopPlayerState = ReturnType<typeof useDesktopPlayerState>;

interface UseDesktopPlayerLogicProps {
    src: string;
    initialTime: number;
    shouldAutoPlay: boolean;
    onError?: (error: string) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    refs: DesktopPlayerState['refs'];
    data: DesktopPlayerState['data'];
    actions: DesktopPlayerState['actions'];
    fullscreenType?: 'native' | 'window';
    isForceLandscape?: boolean;
    seekStepSeconds?: number;
}

export function useDesktopPlayerLogic({
    src,
    initialTime,
    shouldAutoPlay,
    onError,
    onTimeUpdate,
    refs,
    data,
    actions,
    fullscreenType = 'native',
    isForceLandscape = false,
    seekStepSeconds = DEFAULT_SEEK_STEP_SECONDS
}: UseDesktopPlayerLogicProps) {
    const {
        videoRef, containerRef, progressBarRef, volumeBarRef,
        controlsTimeoutRef, speedMenuTimeoutRef, skipForwardTimeoutRef,
        skipBackwardTimeoutRef, volumeBarTimeoutRef, isDraggingProgressRef,
        isDraggingVolumeRef, mouseMoveThrottleRef, toastTimeoutRef
    } = refs;

    const {
        isPlaying,
        duration,
        volume,
        isMuted,
        fullscreenMode,
        showControls,
        playbackRate,
        showSpeedMenu,
        isPiPSupported,
        isAirPlaySupported,
        skipForwardAmount,
        skipBackwardAmount,
        showSkipForwardIndicator,
        showSkipBackwardIndicator,
        showMoreMenu
    } = data;

    const {
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
        setSkipForwardAmount,
        setSkipBackwardAmount,
        setShowSkipForwardIndicator,
        setShowSkipBackwardIndicator,
        setIsSkipForwardAnimatingOut,
        setIsSkipBackwardAnimatingOut,
        setShowVolumeBar,
        setToastMessage,
        setShowToast,
        setIsCastAvailable,
        setIsCasting,
        setShowMoreMenu
    } = actions;

    const playbackControls = usePlaybackControls({
        videoRef, isPlaying, setIsPlaying, setIsLoading,
        initialTime, shouldAutoPlay, setDuration, setBufferedTime, setCurrentTime, onTimeUpdate, onError,
        isDraggingProgressRef, speedMenuTimeoutRef, playbackRate, setPlaybackRate, setShowSpeedMenu,
        volume, isMuted
    });

    const volumeControls = useVolumeControls({
        videoRef, volumeBarRef, volume, isMuted,
        setVolume, setIsMuted, setShowVolumeBar,
        volumeBarTimeoutRef, isDraggingVolumeRef
    });

    const progressControls = useProgressControls({
        videoRef, progressBarRef, duration,
        setCurrentTime, isDraggingProgressRef,
        isRotated: isForceLandscape
    });

    const skipControls = useSkipControls({
        videoRef, duration, seekStepSeconds, setCurrentTime,
        showSkipForwardIndicator, showSkipBackwardIndicator,
        skipForwardAmount, skipBackwardAmount,
        setShowSkipForwardIndicator, setShowSkipBackwardIndicator,
        setSkipForwardAmount, setSkipBackwardAmount,
        setIsSkipForwardAnimatingOut, setIsSkipBackwardAnimatingOut,
        skipForwardTimeoutRef, skipBackwardTimeoutRef
    });

    const fullscreenControls = useFullscreenControls({
        containerRef, videoRef, setIsFullscreen, fullscreenMode, setFullscreenMode,
        isPiPSupported, isAirPlaySupported, setIsPiPSupported, setIsAirPlaySupported,
        fullscreenType
    });

    const controlsVisibility = useControlsVisibility({
        isPlaying, showControls, showSpeedMenu, showMoreMenu,
        setShowControls, setShowSpeedMenu, setShowMoreMenu,
        controlsTimeoutRef, speedMenuTimeoutRef, mouseMoveThrottleRef
    });

    const utilities = useUtilities({
        src, setToastMessage, setShowToast, toastTimeoutRef
    });

    const castControls = useCastControls({
        src, videoRef, setIsCastAvailable, setIsCasting
    });

    useDesktopShortcuts({
        videoRef, isPlaying, volume, isPiPSupported,
        togglePlay: playbackControls.togglePlay,
        toggleMute: volumeControls.toggleMute,
        toggleFullscreen: fullscreenControls.toggleFullscreen,
        toggleWindowFullscreen: fullscreenControls.toggleWindowFullscreen,
        togglePictureInPicture: fullscreenControls.togglePictureInPicture,
        skipForward: skipControls.skipForward,
        skipBackward: skipControls.skipBackward,
        showVolumeBarTemporarily: volumeControls.showVolumeBarTemporarily,
        setShowControls, setVolume, setIsMuted, controlsTimeoutRef
    });

    return useMemo(() => ({
        handleMouseMove: controlsVisibility.handleMouseMove,
        handleTouchToggleControls: controlsVisibility.handleTouchToggleControls,
        togglePlay: playbackControls.togglePlay,
        handlePlay: playbackControls.handlePlay,
        handlePause: playbackControls.handlePause,
        handleTimeUpdateEvent: playbackControls.handleTimeUpdateEvent,
        handleLoadedMetadata: playbackControls.handleLoadedMetadata,
        handleProgressEvent: playbackControls.handleProgressEvent,
        handleVideoError: playbackControls.handleVideoError,
        handleProgressClick: progressControls.handleProgressClick,
        handleProgressMouseDown: progressControls.handleProgressMouseDown,
        handleProgressTouchStart: progressControls.handleProgressTouchStart,
        toggleMute: volumeControls.toggleMute,
        showVolumeBarTemporarily: volumeControls.showVolumeBarTemporarily,
        handleVolumeChange: volumeControls.handleVolumeChange,
        handleVolumeMouseDown: volumeControls.handleVolumeMouseDown,
        toggleFullscreen: fullscreenControls.toggleFullscreen,
        toggleNativeFullscreen: fullscreenControls.toggleNativeFullscreen,
        toggleWindowFullscreen: fullscreenControls.toggleWindowFullscreen,
        togglePictureInPicture: fullscreenControls.togglePictureInPicture,
        showAirPlayMenu: fullscreenControls.showAirPlayMenu,
        showCastMenu: castControls.showCastMenu,
        skipForward: skipControls.skipForward,
        skipBackward: skipControls.skipBackward,
        changePlaybackSpeed: playbackControls.changePlaybackSpeed,
        handleCopyLink: (type: 'original' | 'proxy' = 'original') => {
            const urlToCopy = getCopyUrl(src, type);
            utilities.handleCopyLink(urlToCopy);
        },
        startSpeedMenuTimeout: controlsVisibility.startSpeedMenuTimeout,
        clearSpeedMenuTimeout: controlsVisibility.clearSpeedMenuTimeout,
        formatTime: playbackControls.formatTime
    }), [
        src,
        controlsVisibility,
        playbackControls,
        progressControls,
        volumeControls,
        fullscreenControls,
        castControls,
        skipControls,
        utilities
    ]);
}
