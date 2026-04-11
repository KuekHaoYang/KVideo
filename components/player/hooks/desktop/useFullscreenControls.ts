import { useCallback, useEffect, useMemo } from 'react';
import type { FullscreenMode } from '../useDesktopPlayerState';

interface AndroidPiPBridge {
    isPictureInPictureSupported?: () => boolean;
    enterPictureInPicture?: (width: number, height: number) => boolean;
}

interface UseFullscreenControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    setIsFullscreen: (fullscreen: boolean) => void;
    fullscreenMode: FullscreenMode;
    setFullscreenMode: (mode: FullscreenMode) => void;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    setIsPiPSupported: (supported: boolean) => void;
    setIsAirPlaySupported: (supported: boolean) => void;
    fullscreenType?: 'native' | 'window';
}

export function useFullscreenControls({
    containerRef,
    videoRef,
    setIsFullscreen,
    fullscreenMode,
    setFullscreenMode,
    isPiPSupported,
    isAirPlaySupported,
    setIsPiPSupported,
    setIsAirPlaySupported,
    fullscreenType = 'native'
}: UseFullscreenControlsProps) {
    const lockLandscape = useCallback(async () => {
        if (window.screen && (window.screen as any).orientation && (window.screen as any).orientation.lock) {
            try {
                await (window.screen as any).orientation.lock('landscape');
            } catch (error) {
                console.warn('Orientation lock failed:', error);
            }
        }
    }, []);

    const unlockOrientation = useCallback(() => {
        if (window.screen && (window.screen as any).orientation && (window.screen as any).orientation.unlock) {
            try {
                (window.screen as any).orientation.unlock();
            } catch {
                // Ignore unlock errors from unsupported browsers.
            }
        }
    }, []);

    const getNativeFullscreenElement = useCallback(() => (
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
    ), []);

    const getAndroidPiPBridge = useCallback((): AndroidPiPBridge | null => {
        if (typeof window === 'undefined') return null;

        const bridge = (window as Window & { KVideoAndroid?: AndroidPiPBridge }).KVideoAndroid;
        if (!bridge) return null;

        return bridge;
    }, []);

    const requestAndroidPictureInPicture = useCallback(() => {
        const bridge = getAndroidPiPBridge();
        const video = videoRef.current;
        if (!bridge || !video || typeof bridge.enterPictureInPicture !== 'function') {
            return false;
        }

        const width = video.videoWidth || containerRef.current?.clientWidth || 16;
        const height = video.videoHeight || containerRef.current?.clientHeight || 9;

        try {
            return bridge.enterPictureInPicture(width, height) !== false;
        } catch (error) {
            console.error('Android Picture-in-Picture bridge failed:', error);
            return false;
        }
    }, [containerRef, getAndroidPiPBridge, videoRef]);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const hasNativePiP = Boolean((document as any).pictureInPictureEnabled);
            const hasWebkitPiP = videoRef.current && (
                'webkitSupportsPresentationMode' in (videoRef.current as any) ||
                'webkitPresentationMode' in (videoRef.current as any)
            );
            const androidBridge = getAndroidPiPBridge();
            const hasAndroidPiPBridge = Boolean(androidBridge?.isPictureInPictureSupported?.());
            setIsPiPSupported(hasNativePiP || !!hasWebkitPiP || hasAndroidPiPBridge);
        }
        if (typeof window !== 'undefined') {
            setIsAirPlaySupported('WebKitPlaybackTargetAvailabilityEvent' in window);
        }
    }, [getAndroidPiPBridge, setIsPiPSupported, setIsAirPlaySupported, videoRef]);

    const exitNativeFullscreen = useCallback(async () => {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                await (document as any).webkitExitFullscreen();
            } else if ((document as any).mozCancelFullScreen) {
                await (document as any).mozCancelFullScreen();
            } else if ((document as any).msExitFullscreen) {
                await (document as any).msExitFullscreen();
            }
        } catch (error) {
            console.error('Failed to exit fullscreen:', error);
        } finally {
            unlockOrientation();
            setIsFullscreen(false);
            setFullscreenMode('none');
        }
    }, [setFullscreenMode, setIsFullscreen, unlockOrientation]);

    const exitWindowFullscreen = useCallback(() => {
        unlockOrientation();
        setIsFullscreen(false);
        setFullscreenMode('none');
    }, [setFullscreenMode, setIsFullscreen, unlockOrientation]);

    const enterWindowFullscreen = useCallback(async () => {
        if (fullscreenMode === 'native') {
            await exitNativeFullscreen();
        }

        setFullscreenMode('window');
        setIsFullscreen(true);
        await lockLandscape();
    }, [exitNativeFullscreen, fullscreenMode, lockLandscape, setFullscreenMode, setIsFullscreen]);

    const enterNativeFullscreen = useCallback(async () => {
        if (!containerRef.current) return;

        if (fullscreenMode === 'window') {
            exitWindowFullscreen();
        }

        try {
            if (containerRef.current.requestFullscreen) {
                await containerRef.current.requestFullscreen();
            } else if ((containerRef.current as any).webkitRequestFullscreen) {
                await (containerRef.current as any).webkitRequestFullscreen();
            } else if ((containerRef.current as any).mozRequestFullScreen) {
                await (containerRef.current as any).mozRequestFullScreen();
            } else if ((containerRef.current as any).msRequestFullscreen) {
                await (containerRef.current as any).msRequestFullscreen();
            } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
                (videoRef.current as any).webkitEnterFullscreen();
            }

            setFullscreenMode('native');
            setIsFullscreen(true);
            await lockLandscape();
        } catch (error) {
            console.warn('Fullscreen request failed, trying fallback:', error);
            if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
                try {
                    (videoRef.current as any).webkitEnterFullscreen();
                    setFullscreenMode('native');
                    setIsFullscreen(true);
                } catch (fallbackError) {
                    console.error('Final fullscreen fallback failed:', fallbackError);
                }
            }
        }
    }, [
        containerRef,
        exitWindowFullscreen,
        fullscreenMode,
        lockLandscape,
        setFullscreenMode,
        setIsFullscreen,
        videoRef,
    ]);

    const toggleWindowFullscreen = useCallback(async () => {
        if (fullscreenMode === 'window') {
            exitWindowFullscreen();
            return;
        }

        await enterWindowFullscreen();
    }, [enterWindowFullscreen, exitWindowFullscreen, fullscreenMode]);

    const toggleNativeFullscreen = useCallback(async () => {
        if (fullscreenMode === 'native') {
            await exitNativeFullscreen();
            return;
        }

        await enterNativeFullscreen();
    }, [enterNativeFullscreen, exitNativeFullscreen, fullscreenMode]);

    const toggleFullscreen = useCallback(async () => {
        if (fullscreenMode === 'window') {
            exitWindowFullscreen();
            return;
        }

        if (fullscreenMode === 'native') {
            await exitNativeFullscreen();
            return;
        }

        if (fullscreenType === 'window') {
            await enterWindowFullscreen();
            return;
        }

        await enterNativeFullscreen();
    }, [
        enterNativeFullscreen,
        enterWindowFullscreen,
        exitNativeFullscreen,
        exitWindowFullscreen,
        fullscreenMode,
        fullscreenType,
    ]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const nativeFullscreenElement = getNativeFullscreenElement();

            if (nativeFullscreenElement) {
                setIsFullscreen(true);
                setFullscreenMode('native');
                lockLandscape().catch(() => { });
                return;
            }

            if (fullscreenMode === 'native') {
                unlockOrientation();
                setIsFullscreen(false);
                setFullscreenMode('none');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, [fullscreenMode, getNativeFullscreenElement, lockLandscape, setFullscreenMode, setIsFullscreen, unlockOrientation]);

    useEffect(() => {
        if (fullscreenMode !== 'window') return;

        const previousOverflow = document.body.style.overflow;
        const previousOverscroll = document.body.style.overscrollBehavior;

        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'contain';

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.overscrollBehavior = previousOverscroll;
        };
    }, [fullscreenMode]);

    useEffect(() => {
        if (fullscreenMode !== 'window') return;

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                exitWindowFullscreen();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [exitWindowFullscreen, fullscreenMode]);

    const togglePictureInPicture = useCallback(async () => {
        if (!videoRef.current || !isPiPSupported) return;
        const video = videoRef.current as any;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (video.webkitPresentationMode === 'picture-in-picture') {
                video.webkitSetPresentationMode('inline');
            } else if (video.requestPictureInPicture && (document as any).pictureInPictureEnabled) {
                await video.requestPictureInPicture();
            } else if (requestAndroidPictureInPicture()) {
                return;
            } else if (video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode('picture-in-picture')) {
                video.webkitSetPresentationMode('picture-in-picture');
            }
        } catch (error) {
            if (requestAndroidPictureInPicture()) {
                return;
            }
            console.error('Failed to toggle Picture-in-Picture:', error);
        }
    }, [isPiPSupported, requestAndroidPictureInPicture, videoRef]);

    const showAirPlayMenu = useCallback(() => {
        if (!videoRef.current || !isAirPlaySupported) return;
        const video = videoRef.current as any;
        if (video.webkitShowPlaybackTargetPicker) {
            video.webkitShowPlaybackTargetPicker();
        }
    }, [videoRef, isAirPlaySupported]);

    const fullscreenActions = useMemo(() => ({
        toggleFullscreen,
        toggleNativeFullscreen,
        toggleWindowFullscreen,
        togglePictureInPicture,
        showAirPlayMenu
    }), [
        toggleFullscreen,
        toggleNativeFullscreen,
        toggleWindowFullscreen,
        togglePictureInPicture,
        showAirPlayMenu
    ]);

    return fullscreenActions;
}
