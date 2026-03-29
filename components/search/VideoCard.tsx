'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { VideoCardPoster } from './VideoCardPoster';
import { VideoCardInfo } from './VideoCardInfo';
import { Video } from '@/lib/types';

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
            style={{ position: 'relative', zIndex: 1 }}
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
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <VideoCardPoster video={video} isActive={isActive} isPremium={isPremium} displayLatency={displayLatency} />
                    <VideoCardInfo video={video} />
                </Card>
            </Link>
        </div>
    );
});

VideoCard.displayName = 'VideoCard';