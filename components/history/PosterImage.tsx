/**
 * PosterImage - Video poster with fallback handling
 */


import { Icons } from '@/components/ui/Icon';
import { RemotePosterImage } from '@/components/ui/RemotePosterImage';

interface PosterImageProps {
    poster?: string;
    title: string;
    progress: number;
}

export function PosterImage({ poster, title, progress }: PosterImageProps) {
    return (
        <div className="relative w-28 h-16 flex-shrink-0 bg-[var(--glass-bg)] rounded-[var(--radius-2xl)] overflow-hidden">
            {poster ? (
                <RemotePosterImage
                    src={poster}
                    alt={title}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Icons.Film size={32} className="text-[var(--text-color-secondary)] opacity-30" />
                </div>
            )}
            {/* Progress overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                    className="h-full bg-[var(--accent-color)]"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        </div>
    );
}
