'use client';

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';

import { Video } from '@/lib/types';
import { parseVideoTitle, extractQualityLabel } from '@/lib/utils/video';

interface VideoCardProps {
    video: Video;
    videoUrl: string;
    cardId: string;
    isActive: boolean;
    onCardClick: (e: React.MouseEvent, cardId: string, videoUrl: string) => void;
    isPremium?: boolean;
    latencies?: Record<string, number>;
}

export const VideoCard = memo<VideoCardProps>(({
    video,
    videoUrl,
    cardId,
    isActive,
    onCardClick,
    isPremium = false,
    latencies = {}
}) => {
    const displayLatency = latencies[video.source] ?? video.latency;
    return (
        <div
            style={{
                position: 'relative',
                zIndex: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.zIndex = '100')}
            onMouseLeave={(e) => (e.currentTarget.style.zIndex = '1')}
        >
            <Link
                key={cardId}
                href={videoUrl}
                onClick={(e) => onCardClick(e, cardId, videoUrl)}
                role="listitem"
                aria-label={`${video.vod_name}${video.vod_remarks ? ` - ${video.vod_remarks}` : ''}`}
                prefetch={false}
                data-focusable
                className="group cursor-pointer hover:translate-y-[-2px] transition-transform duration-200 ease-out block h-full"
            >
                <Card
                    className="p-0 flex flex-col h-full bg-[var(--bg-color)]/50 backdrop-blur-none saturate-100 shadow-sm border-[var(--glass-border)] hover:shadow-lg transition-shadow"
                    hover={false}
                    blur={false}
                    style={{
                        backfaceVisibility: 'hidden',
                    }}
                >
                    {/* Poster */}
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

                        {/* Fallback Icon - visible when image fails */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center -z-10 gap-2">
                            <Icons.Film size={48} className="text-[var(--text-color-secondary)] opacity-40" />
                            <span className="text-xs text-[var(--text-color-secondary)] opacity-60 px-2 text-center line-clamp-2">{video.vod_name}</span>
                        </div>

                        {/* Badge Container */}
                        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 min-w-0">
                                {video.sourceName && (
                                    <Badge variant="primary" className="bg-[var(--accent-color)] flex-shrink-0 max-w-[50%] truncate">
                                        {video.sourceName}
                                    </Badge>
                                )}
                                {video.type_name && (
                                    <Badge variant="secondary" className="flex-shrink-0 max-w-[40%] truncate text-[10px]">
                                        {video.type_name}
                                    </Badge>
                                )}
                            </div>

                            {displayLatency !== undefined && (
                                <LatencyBadge latency={displayLatency} className="flex-shrink-0" />
                            )}
                        </div>

                        {/* Favorite Button - Top Right */}
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

                        {/* Overlay */}
                        <div
                            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isActive ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100' : 'opacity-0 lg:group-hover:opacity-100'
                                }`}
                            style={{
                                willChange: 'opacity',
                            }}
                        >
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                {isActive && (
                                    <div className="lg:hidden text-white/90 text-xs mb-2 font-medium">
                                        再次点击播放 →
                                    </div>
                                )}
                                {video.type_name && (
                                    <Badge variant="secondary" className="text-xs mb-2">
                                        {video.type_name}
                                    </Badge>
                                )}
                                {video.vod_year && (
                                    <div className="flex items-center gap-1 text-white/80 text-xs">
                                        <Icons.Calendar size={12} />
                                        <span>{video.vod_year}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col">
                        {(() => {
                            const { cleanTitle, quality } = parseVideoTitle(video.vod_name);
                            // Visual priority: Quality from title tag, then vod_remarks
                            const displayQuality = quality || video.vod_remarks;
                            const qualityBadge = extractQualityLabel(video.vod_remarks, quality);

                            return (
                                <>
                                    <h4 className="font-semibold text-sm text-[var(--text-color)] line-clamp-2 min-h-[2.5rem] mb-1">
                                        {cleanTitle}
                                    </h4>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {qualityBadge && (
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${qualityBadge.color}`}>
                                                {qualityBadge.label}
                                            </span>
                                        )}
                                        {displayQuality && (
                                            <p className="text-xs text-[var(--text-color-secondary)] font-medium truncate">
                                                {displayQuality}
                                            </p>
                                        )}
                                    </div>
                                    {/* Hide remarks if it was used as quality to avoid duplication */}
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
                                </>
                            );
                        })()}
                    </div>
                </Card>
            </Link>
        </div>
    );
});

VideoCard.displayName = 'VideoCard';

