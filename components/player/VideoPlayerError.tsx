'use client';

import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icon';

interface VideoPlayerErrorProps {
    error: string;
    onBack: () => void;
    onRetry: () => void;
    retryCount: number;
    maxRetries: number;
}

export function VideoPlayerError({
    error,
    onBack,
    onRetry,
    retryCount,
    maxRetries,
}: VideoPlayerErrorProps) {
    return (
        <div className="aspect-video bg-black rounded-[var(--radius-2xl)] flex items-center justify-center">
            {/* Glass Card Container */}
            <div
                className="player-error-glass animate-in fade-in zoom-in-95 duration-300"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
            >
                {/* Glowing Error Icon */}
                <div className="relative">
                    <Icons.AlertTriangle
                        size={56}
                        className="error-icon mx-auto mb-4"
                    />
                    {/* Glow effect */}
                    <div className="absolute inset-0 blur-xl bg-red-500/30 rounded-full -z-10" />
                </div>

                <h3>播放失败</h3>
                <p>{error}</p>

                {/* Browser compatibility hint */}
                {(error.includes('不支持') || error.includes('格式') || error.includes('编码')) && (
                    <p className="text-xs text-white/50 mt-1">
                        建议使用 Chrome、Edge 或 Safari 浏览器以获得最佳兼容性
                    </p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center flex-wrap">
                    <button
                        onClick={onBack}
                        className="btn-glass px-4 py-2 flex items-center gap-2"
                    >
                        <Icons.ChevronLeft size={18} />
                        <span>返回</span>
                    </button>
                    {retryCount < maxRetries && (
                        <button
                            onClick={onRetry}
                            className="btn-glass px-4 py-2 flex items-center gap-2 !bg-[var(--accent-color)]/80 hover:!bg-[var(--accent-color)]"
                        >
                            <Icons.RefreshCw size={18} />
                            <span>重试 ({retryCount}/{maxRetries})</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
