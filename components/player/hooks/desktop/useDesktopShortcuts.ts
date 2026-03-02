import { useEffect } from 'react';

interface UseDesktopShortcutsProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isPlaying: boolean;
    volume: number;
    isPiPSupported: boolean;
    togglePlay: () => void;
    toggleMute: () => void;
    toggleFullscreen: () => void;
    togglePictureInPicture: () => void;
    skipForward: () => void;
    skipBackward: () => void;
    showVolumeBarTemporarily: () => void;
    setShowControls: (show: boolean) => void;
    setVolume: (volume: number) => void;
    setIsMuted: (muted: boolean) => void;
    controlsTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export function useDesktopShortcuts({
    videoRef,
    isPlaying,
    volume,
    isPiPSupported,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    togglePictureInPicture,
    skipForward,
    skipBackward,
    showVolumeBarTemporarily,
    setShowControls,
    setVolume,
    setIsMuted,
    controlsTimeoutRef,
}: UseDesktopShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore shortcuts if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Show controls on any key press
            setShowControls(true);
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            if (isPlaying) {
                controlsTimeoutRef.current = setTimeout(() => {
                    setShowControls(false);
                }, 3000);
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'p':
                    if (isPiPSupported) {
                        e.preventDefault();
                        togglePictureInPicture();
                    }
                    break;
                case 'arrowright':
                case 'l':
                    e.preventDefault();
                    skipForward();
                    break;
                case 'arrowleft':
                case 'j':
                    e.preventDefault();
                    skipBackward();
                    break;
                case 'arrowup':
                    e.preventDefault();
                    const newVolUp = Math.min(1, volume + 0.1);
                    setVolume(newVolUp);
                    if (videoRef.current) {
                        videoRef.current.volume = newVolUp;
                        videoRef.current.muted = newVolUp === 0;
                    }
                    setIsMuted(newVolUp === 0);
                    localStorage.setItem('kvideo-volume', String(newVolUp));
                    localStorage.setItem('kvideo-muted', String(newVolUp === 0));
                    showVolumeBarTemporarily();
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    const newVolDown = Math.max(0, volume - 0.1);
                    setVolume(newVolDown);
                    if (videoRef.current) {
                        videoRef.current.volume = newVolDown;
                        videoRef.current.muted = newVolDown === 0;
                    }
                    setIsMuted(newVolDown === 0);
                    localStorage.setItem('kvideo-volume', String(newVolDown));
                    localStorage.setItem('kvideo-muted', String(newVolDown === 0));
                    showVolumeBarTemporarily();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        videoRef,
        isPlaying,
        volume,
        isPiPSupported,
        togglePlay,
        toggleMute,
        toggleFullscreen,
        togglePictureInPicture,
        skipForward,
        skipBackward,
        showVolumeBarTemporarily,
        setShowControls,
        setVolume,
        setIsMuted,
        controlsTimeoutRef,
    ]);
}
