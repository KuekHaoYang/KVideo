'use client';

import { Badge } from '@/components/ui/Badge';
import { LatencyBadge } from '@/components/ui/LatencyBadge';

interface VideoCardBadgesProps {
    sourceName?: string;
    typeName?: string;
    latency?: number;
}

export function VideoCardBadges({ sourceName, typeName, latency }: VideoCardBadgesProps) {
    return (
        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
                {sourceName && (
                    <Badge variant="primary" className="bg-[var(--accent-color)] flex-shrink-0 max-w-[50%] truncate">
                        {sourceName}
                    </Badge>
                )}
                {typeName && (
                    <Badge variant="secondary" className="flex-shrink-0 max-w-[40%] truncate text-[10px]">
                        {typeName}
                    </Badge>
                )}
            </div>

            {latency !== undefined && (
                <LatencyBadge latency={latency} className="flex-shrink-0" />
            )}
        </div>
    );
}