import React, { RefObject } from 'react';

interface DesktopProgressBarProps {
    progressBarRef: RefObject<HTMLDivElement | null>;

    currentTime: number;
    duration: number;
    bufferedTime: number;
    onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onProgressTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
}

export function DesktopProgressBar({
    progressBarRef,
    currentTime,
    duration,
    bufferedTime,
    onProgressClick,
    onProgressMouseDown,
    onProgressTouchStart
}: DesktopProgressBarProps) {
    return (
        <div className="px-4 pb-1">
            <div
                ref={progressBarRef}
                className="slider-track cursor-pointer"
                onClick={onProgressClick}
                onMouseDown={onProgressMouseDown}
                onTouchStart={onProgressTouchStart}
                style={{ pointerEvents: 'auto' }}
            >
                <div
                    className="slider-buffer"
                    style={{ width: `${(bufferedTime / duration) * 100 || 0}%` }}
                />
                <div
                    className="slider-range"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                />
                <div
                    className="slider-thumb"
                    style={{ left: `${(currentTime / duration) * 100 || 0}%` }}
                />
            </div>
        </div>
    );
}
