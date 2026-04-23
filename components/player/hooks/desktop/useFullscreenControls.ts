import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FullscreenMode } from '../useDesktopPlayerState';
import {
    createAndroidPiPTransitionPlan,
    getAndroidPiPSourceRect,
    shouldRestoreInlineAfterAndroidPiP,
    shouldRollbackTemporaryWindowFullscreen,
    type AndroidPiPSessionState,
} from './android-pip-utils';

interface AndroidPiPBridge {
    isPictureInPictureSupported?: () => boolean;
    enterPictureInPicture?: (
        width: number,
        height: number,
        left: number,
        top: number,
        right: number,
        bottom: number
    ) => boolean;
}

interface AndroidPiPChangeDetail {
    inPictureInPicture?: boolean;
}

type OrientationCapableScreen = Screen & {
    orientation?: ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
        unlock?: () => void;
    };
};

type FullscreenCapableDocument = Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    pictureInPictureEnabled?: boolean;
    pictureInPictureElement?: Element | null;
    exitPictureInPicture?: () => Promise<void>;
};

type FullscreenCapableElement = HTMLDivElement & {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
};

type PiPCapableVideoElement = HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitSupportsPresentationMode?: (mode: 'picture-in-picture') => boolean;
    webkitPresentationMode?: 'inline' | 'picture-in-picture' | string;
    webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture') => void;
    webkitShowPlaybackTargetPicker?: () => void;
};

function getFullscreenDocument(): FullscreenCapableDocument {
    return document as FullscreenCapableDocument;
}

function waitForAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

async function waitForWindowFullscreenLayout(): Promise<void> {
    await waitForAnimationFrame();
    await waitForAnimationFrame();
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
    const androidPiPSessionRef = useRef<AndroidPiPSessionState | null>(null);

    const lockLandscape = useCallback(async () => {
        const orientation = (window.screen as OrientationCapableScreen).orientation;
        if (orientation?.lock) {
            try {
                await orientation.lock('landscape');
            } catch (error) {
                console.warn('Orientation lock failed:', error);
            }
        }
    }, []);

    const unlockOrientation = useCallback(() => {
        const orientation = (window.screen as OrientationCapableScreen).orientation;
        if (orientation?.unlock) {
            try {
                orientation.unlock();
            } catch {
                // Ignore unlock errors from unsupported browsers.
            }
        }
    }, []);

    const getNativeFullscreenElement = useCallback(() => {
        const fullscreenDocument = getFullscreenDocument();
        return (
            fullscreenDocument.fullscreenElement ||
            fullscreenDocument.webkitFullscreenElement ||
            fullscreenDocument.mozFullScreenElement ||
            fullscreenDocument.msFullscreenElement
        );
    }, []);

    const getAndroidPiPBridge = useCallback((): AndroidPiPBridge | null => {
        if (typeof window === 'undefined') return null;

        const bridge = (window as Window & { KVideoAndroid?: AndroidPiPBridge }).KVideoAndroid;
        if (!bridge) return null;

        return bridge;
    }, []);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const fullscreenDocument = getFullscreenDocument();
            const video = videoRef.current as PiPCapableVideoElement | null;
            const hasNativePiP = Boolean(fullscreenDocument.pictureInPictureEnabled);
            const hasWebkitPiP = Boolean(video && (
                typeof video.webkitSupportsPresentationMode === 'function' ||
                typeof video.webkitPresentationMode === 'string'
            ));
            const androidBridge = getAndroidPiPBridge();
            const hasAndroidPiPBridge = Boolean(androidBridge?.isPictureInPictureSupported?.());
            setIsPiPSupported(hasNativePiP || !!hasWebkitPiP || hasAndroidPiPBridge);
        }
        if (typeof window !== 'undefined') {
            setIsAirPlaySupported('WebKitPlaybackTargetAvailabilityEvent' in window);
        }
    }, [getAndroidPiPBridge, setIsPiPSupported, setIsAirPlaySupported, videoRef]);

    const exitNativeFullscreen = useCallback(async () => {
        const fullscreenDocument = getFullscreenDocument();

        try {
            if (fullscreenDocument.exitFullscreen) {
                await fullscreenDocument.exitFullscreen();
            } else if (fullscreenDocument.webkitExitFullscreen) {
                await fullscreenDocument.webkitExitFullscreen();
            } else if (fullscreenDocument.mozCancelFullScreen) {
                await fullscreenDocument.mozCancelFullScreen();
            } else if (fullscreenDocument.msExitFullscreen) {
                await fullscreenDocument.msExitFullscreen();
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
        const container = containerRef.current as FullscreenCapableElement | null;
        const video = videoRef.current as PiPCapableVideoElement | null;
        if (!container) return;

        if (fullscreenMode === 'window') {
            exitWindowFullscreen();
        }

        try {
            if (container.requestFullscreen) {
                await container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                await container.webkitRequestFullscreen();
            } else if (container.mozRequestFullScreen) {
                await container.mozRequestFullScreen();
            } else if (container.msRequestFullscreen) {
                await container.msRequestFullscreen();
            } else if (video?.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            }

            setFullscreenMode('native');
            setIsFullscreen(true);
            await lockLandscape();
        } catch (error) {
            console.warn('Fullscreen request failed, trying fallback:', error);
            if (video?.webkitEnterFullscreen) {
                try {
                    video.webkitEnterFullscreen();
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

    const requestAndroidPictureInPicture = useCallback(async () => {
        const bridge = getAndroidPiPBridge();
        const video = videoRef.current;
        if (!bridge || !video || typeof bridge.enterPictureInPicture !== 'function') {
            return false;
        }

        const plan = createAndroidPiPTransitionPlan(fullscreenMode);
        const session: AndroidPiPSessionState = {
            enteredTemporaryWindowFullscreen: plan.enterTemporaryWindowFullscreen,
            restoreInlineOnExit: plan.restoreInlineOnExit,
        };

        try {
            if (plan.enterTemporaryWindowFullscreen) {
                await enterWindowFullscreen();
                await waitForWindowFullscreenLayout();
            }

            const width = video.videoWidth || containerRef.current?.clientWidth || 16;
            const height = video.videoHeight || containerRef.current?.clientHeight || 9;
            const sourceRect = getAndroidPiPSourceRect(containerRef.current);

            androidPiPSessionRef.current = session;

            const didEnterPiP = bridge.enterPictureInPicture(
                width,
                height,
                sourceRect?.left ?? 0,
                sourceRect?.top ?? 0,
                sourceRect?.right ?? 0,
                sourceRect?.bottom ?? 0
            ) !== false;

            if (!didEnterPiP) {
                if (shouldRollbackTemporaryWindowFullscreen(session)) {
                    exitWindowFullscreen();
                }
                androidPiPSessionRef.current = null;
            }

            return didEnterPiP;
        } catch (error) {
            if (shouldRollbackTemporaryWindowFullscreen(session)) {
                exitWindowFullscreen();
            }
            androidPiPSessionRef.current = null;
            console.error('Android Picture-in-Picture bridge failed:', error);
            return false;
        }
    }, [
        containerRef,
        enterWindowFullscreen,
        exitWindowFullscreen,
        fullscreenMode,
        getAndroidPiPBridge,
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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleAndroidPiPChange = (event: Event) => {
            const detail = (event as CustomEvent<AndroidPiPChangeDetail>).detail;
            const inPictureInPicture = Boolean(detail?.inPictureInPicture);

            if (shouldRestoreInlineAfterAndroidPiP(androidPiPSessionRef.current, inPictureInPicture)) {
                exitWindowFullscreen();
            }

            if (!inPictureInPicture) {
                androidPiPSessionRef.current = null;
            }
        };

        window.addEventListener('kvideo-android-pip-change', handleAndroidPiPChange);
        return () => window.removeEventListener('kvideo-android-pip-change', handleAndroidPiPChange);
    }, [exitWindowFullscreen]);

    const togglePictureInPicture = useCallback(async () => {
        if (!videoRef.current || !isPiPSupported) return;
        const video = videoRef.current as PiPCapableVideoElement;
        const fullscreenDocument = getFullscreenDocument();
        try {
            if (fullscreenDocument.pictureInPictureElement && fullscreenDocument.exitPictureInPicture) {
                await fullscreenDocument.exitPictureInPicture();
            } else if (video.webkitPresentationMode === 'picture-in-picture') {
                video.webkitSetPresentationMode?.('inline');
            } else if (video.requestPictureInPicture && fullscreenDocument.pictureInPictureEnabled) {
                await video.requestPictureInPicture();
            } else if (await requestAndroidPictureInPicture()) {
                return;
            } else if (
                video.webkitSupportsPresentationMode?.('picture-in-picture') &&
                video.webkitSetPresentationMode
            ) {
                video.webkitSetPresentationMode('picture-in-picture');
            }
        } catch (error) {
            if (await requestAndroidPictureInPicture()) {
                return;
            }
            console.error('Failed to toggle Picture-in-Picture:', error);
        }
    }, [isPiPSupported, requestAndroidPictureInPicture, videoRef]);

    const showAirPlayMenu = useCallback(() => {
        if (!videoRef.current || !isAirPlaySupported) return;
        const video = videoRef.current as PiPCapableVideoElement;
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
