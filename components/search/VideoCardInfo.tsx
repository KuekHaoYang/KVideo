'use client';

import { parseVideoTitle } from '@/lib/utils/video';
import { Video } from '@/lib/types';

interface VideoCardInfoProps {
    video: Video;
}

export function VideoCardInfo({ video }: VideoCardInfoProps) {
    const { cleanTitle, quality } = parseVideoTitle(video.vod_name);
    const displayQuality = quality || video.vod_remarks;

    return (
        <div className="p-3 flex-1 flex flex-col">
            <h4 className="font-semibold text-sm text-[var(--text-color)] line-clamp-2 min-h-[2.5rem] mb-1">
                {cleanTitle}
            </h4>
            {displayQuality && (
                <p className="text-xs text-[var(--text-color-secondary)] font-medium">
                    {displayQuality}
                </p>
            )}
            {video.vod_remarks && video.vod_remarks !== displayQuality && (
                <p className="text-xs text-[var(--text-color-secondary)] mt-1 line-clamp-1">
                    {video.vod_remarks}
                </p>
            )}
            {video.vod_lang && (
                <p className="text-xs text-[var(--text-color-secondary)] mt-1">
                    {video.vod_lang}
                </p>
            )}
        </div>
    );
}