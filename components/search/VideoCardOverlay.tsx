'use client';

import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';

interface VideoCardOverlayProps {
    isActive: boolean;
    typeName?: string;
    vodYear?: string;
}

export function VideoCardOverlay({ isActive, typeName, vodYear }: VideoCardOverlayProps) {
    return (
        <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isActive ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100' : 'opacity-0 lg:group-hover:opacity-100'
                }`}
            style={{ willChange: 'opacity' }}
        >
            <div className="absolute bottom-0 left-0 right-0 p-3">
                {isActive && (
                    <div className="lg:hidden text-white/90 text-xs mb-2 font-medium">
                        再次点击播放 →
                    </div>
                )}
                {typeName && (
                    <Badge variant="secondary" className="text-xs mb-2">
                        {typeName}
                    </Badge>
                )}
                {vodYear && (
                    <div className="flex items-center gap-1 text-white/80 text-xs">
                        <Icons.Calendar size={12} />
                        <span>{vodYear}</span>
                    </div>
                )}
            </div>
        </div>
    );
}