'use client';

/**
 * VideoGroupCard - Displays grouped videos with same name as single card
 * Following Liquid Glass design system
 */

import { memo, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { Video } from '@/lib/types';
import { parseVideoTitle } from '@/lib/utils/video';

export interface GroupedVideo {
    /** Representative video (lowest latency) */
    representative: Video;
    /** All videos in this group */
    videos: Video[];
    /** Group name (vod_name) */
    name: string;
}

interface VideoGroupCardProps {
    group: GroupedVideo;
    cardId: string;
    isActive: boolean;
    onCardClick: (e: React.MouseEvent, cardId: string, videoUrl: string) => void;
    isPremium?: boolean;
    latencies?: Record<string, number>;
}

export const VideoGroupCard = memo<VideoGroupCardProps>(({
    group,
    cardId,
    isActive,
    onCardClick,
    isPremium = false,
    latencies = {}
}) => {
    const { representative, videos, name } = group;

    // Best latency from the group, preferring real-time updates
    const bestLatency = useMemo(() => {
        const currentLatencies = videos.map(v => latencies[v.source] ?? v.latency).filter(l => l !== undefined) as number[];
        return currentLatencies.length > 0 ? Math.min(...currentLatencies) : undefined;
    }, [videos, latencies]);

    // Generate URL with grouped sources data
    const videoUrl = useMemo(() => {
        const params = new URLSearchParams({
            id: String(representative.vod_id),
            source: representative.source,
            title: representative.vod_name,
        });

        // Add group data if multiple sources
        if (videos.length > 1) {
            const groupData = videos.map(v => ({
                id: v.vod_id,
                source: v.source,
                sourceName: v.sourceName,
                latency: v.latency,
                pic: v.vod_pic,
                typeName: v.type_name,
                remarks: v.vod_remarks,
            }));
            params.set('groupedSources', JSON.stringify(groupData));
        }

        return `/player?${params.toString()}`;
    }, [representative, videos]);

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
                aria-label={`${name} - ${videos.length} 个源${representative.vod_remarks ? ` - ${representative.vod_remarks}` : ''}`}
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
                        {representative.vod_pic ? (
                            <Image
                                src={representative.vod_pic}
                                alt={name}
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
                            <span className="text-xs text-[var(--text-color-secondary)] opacity-60 px-2 text-center line-clamp-2">{name}</span>
                        </div>

                        {/* Badge Container */}
                        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
                            {/* Source count badge */}
                            <Badge variant="primary" className="bg-[var(--accent-color)] flex-shrink-0">
                                <Icons.Layers size={12} className="mr-1" />
                                {videos.length} 源
                            </Badge>

                            {bestLatency !== undefined && (
                                <LatencyBadge latency={bestLatency} className="flex-shrink-0" />
                            )}
                        </div>

                        {/* Favorite Button - Top Right */}
                        <div className={`absolute top-2 right-2 z-20 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <FavoriteButton
                                videoId={representative.vod_id}
                                source={representative.source}
                                title={name}
                                poster={representative.vod_pic}
                                sourceName={representative.sourceName}
                                type={representative.type_name}
                                year={representative.vod_year}
                                remarks={representative.vod_remarks}
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
                                {representative.type_name && (
                                    <Badge variant="secondary" className="text-xs mb-2">
                                        {representative.type_name}
                                    </Badge>
                                )}
                                {representative.vod_year && (
                                    <div className="flex items-center gap-1 text-white/80 text-xs">
                                        <Icons.Calendar size={12} />
                                        <span>{representative.vod_year}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col">
                        {(() => {
                            const { cleanTitle, quality } = parseVideoTitle(name);
                            const displayQuality = quality || representative.vod_remarks;

                            return (
                                <>
                                    <h4 className="font-semibold text-sm text-[var(--text-color)] line-clamp-2 min-h-[2.5rem] mb-1">
                                        {cleanTitle}
                                    </h4>
                                    {displayQuality && (
                                        <p className="text-xs text-[var(--text-color-secondary)] font-medium">
                                            {displayQuality}
                                        </p>
                                    )}
                                    {representative.vod_lang && (
                                        <p className="text-xs text-[var(--text-color-secondary)] mt-1">
                                            {representative.vod_lang}
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

VideoGroupCard.displayName = 'VideoGroupCard';
