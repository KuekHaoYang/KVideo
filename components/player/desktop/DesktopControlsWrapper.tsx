import React from 'react';
import { DesktopControls } from './DesktopControls';
import { useDesktopPlayerState } from '../hooks/useDesktopPlayerState';
import { useDesktopPlayerLogic } from '../hooks/useDesktopPlayerLogic';

interface DesktopControlsWrapperProps {
    src: string;
    data: ReturnType<typeof useDesktopPlayerState>['data'];
    logic: ReturnType<typeof useDesktopPlayerLogic>;
    refs: ReturnType<typeof useDesktopPlayerState>['refs'];
}

export function DesktopControlsWrapper({ src, data, logic, refs }: DesktopControlsWrapperProps) {
    const {
        isPlaying,
        currentTime,
        duration,
        bufferedTime,
        volume,
        isMuted,
        isFullscreen,
        fullscreenMode,
        showControls,
        showVolumeBar,
        isPiPSupported,
        isAirPlaySupported,
        isCastAvailable,
    } = data;

    const {
        togglePlay,
        toggleMute,
        handleVolumeChange,
        handleVolumeMouseDown,
        toggleFullscreen,
        toggleNativeFullscreen,
        toggleWindowFullscreen,
        togglePictureInPicture,
        showAirPlayMenu,
        showCastMenu,
        handleProgressClick,
        handleProgressMouseDown,
        handleProgressTouchStart,
        formatTime,
    } = logic;

    const {
        progressBarRef,
        volumeBarRef,
    } = refs;

    const isProxied = src.includes('/api/proxy');

    return (
        <DesktopControls
            showControls={showControls}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            bufferedTime={bufferedTime}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isNativeFullscreen={fullscreenMode === 'native'}
            isWebFullscreen={fullscreenMode === 'window'}
            showVolumeBar={showVolumeBar}
            isPiPSupported={isPiPSupported}
            isAirPlaySupported={isAirPlaySupported}
            isCastAvailable={isCastAvailable}
            isProxied={isProxied}
            progressBarRef={progressBarRef}
            volumeBarRef={volumeBarRef}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onVolumeChange={handleVolumeChange}
            onVolumeMouseDown={handleVolumeMouseDown}
            onToggleFullscreen={toggleFullscreen}
            onToggleNativeFullscreen={toggleNativeFullscreen}
            onToggleWebFullscreen={toggleWindowFullscreen}
            onTogglePictureInPicture={togglePictureInPicture}
            onShowAirPlayMenu={showAirPlayMenu}
            onShowCastMenu={showCastMenu}
            onProgressClick={handleProgressClick}
            onProgressMouseDown={handleProgressMouseDown}
            onProgressTouchStart={handleProgressTouchStart}
            formatTime={formatTime}
        />
    );
}
