'use client';

import Image from 'next/image';
import { Icons } from '@/components/ui/Icon';
import { VideoCardBadges } from './VideoCardBadges';
import { VideoCardOverlay } from './VideoCardOverlay';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Video } from '@/lib/types';

interface VideoCardPosterProps {
    video: Video;
    isActive: boolean;
    isPremium?: boolean;
}

export function VideoCardPoster({ video, isActive, isPremium }: VideoCardPosterProps) {
    return (
        <div className="relative aspect-[2/3] bg-[color-mix(in_srgb,var(--glass-bg)_50%,transparent)] rounded-[var(--radius-2xl)] overflow-hidden">
            {video.vod_pic ? (
                <Image
                    src={video.vod_pic}
                    alt={video.vod_name}
                    fill
                    className="object-cover rounded-[var(--radius-2xl)]"
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                    loading="eager"
                    unoptimized
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.opacity = '0';
                    }}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Icons.Film size={64} className="text-[var(--text-color-secondary)]" />
                </div>
            )}

            {/* Fallback Icon */}
            <div className="absolute inset-0 flex flex-col items-center justify-center -z-10 gap-2">
                <Icons.Film size={48} className="text-[var(--text-color-secondary)] opacity-40" />
                <span className="text-xs text-[var(--text-color-secondary)] opacity-60 px-2 text-center line-clamp-2">{video.vod_name}</span>
            </div>

            <VideoCardBadges
                sourceName={video.sourceName}
                typeName={video.type_name}
                latency={video.latency}
                isActive={isActive}
            />

            {/* Favorite Button */}
            <div className={`absolute top-2 right-2 z-20 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <FavoriteButton
                    videoId={video.vod_id}
                    source={video.source}
                    title={video.vod_name}
                    poster={video.vod_pic}
                    sourceName={video.sourceName}
                    type={video.type_name}
                    year={video.vod_year}
                    remarks={video.vod_remarks}
                    size={16}
                    className="shadow-md"
                    isPremium={isPremium}
                />
            </div>

            <VideoCardOverlay
                isActive={isActive}
                typeName={video.type_name}
                vodYear={video.vod_year}
            />
        </div>
    );
}