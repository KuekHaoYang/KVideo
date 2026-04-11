'use client';

import { useState } from 'react';
import type { SourceSubscription } from '@/lib/types';
import { createSubscription } from '@/lib/utils/source-import-utils';

interface SubscriptionImportTabProps {
    subscriptions: SourceSubscription[];
    onAdd: (subscription: SourceSubscription) => Promise<boolean> | boolean;
    onRemove: (id: string) => void;
    onRefresh: (subscription: SourceSubscription) => Promise<void>;
}

export function SubscriptionImportTab({
    subscriptions,
    onAdd,
    onRemove,
    onRefresh
}: SubscriptionImportTabProps) {
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState('');

    const handleAddKeydown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAdd();
    };

    const handleAdd = async () => {
        if (!url.trim() || !name.trim()) {
            setError("请输入订阅名称和链接");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const newSub = createSubscription(name, url);
            // Immediately try to fetch (test connection)
            // The parent handler should assume responsibility for fetching content 
            // but here we just pass the object
            await onAdd(newSub);
            setUrl('');
            setName('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '添加订阅失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (sub: SourceSubscription) => {
        setRefreshingIds(prev => new Set(prev).add(sub.id));
        try {
            await onRefresh(sub);
        } finally {
            setRefreshingIds(prev => {
                const next = new Set(prev);
                next.delete(sub.id);
                return next;
            });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-h-[60vh] overflow-y-auto px-1">
                {/* Add New Subscription */}
                <div className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] space-y-3">
                    <h4 className="font-semibold text-[var(--text-color)] text-sm">添加新订阅</h4>
                    <div className="grid gap-3">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="订阅名称 (例如: 每日更新源)"
                            onKeyDown={handleAddKeydown}
                            className="w-full bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] px-4 py-2 text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)] focus:outline-none focus:border-[var(--accent-color)]"
                        />
                        <div className="flex gap-2 flex-wrap">
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="订阅链接 (URL)"
                                onKeyDown={handleAddKeydown}
                                className="flex-1 bg-[color-mix(in_srgb,var(--bg-color)_50%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] px-4 py-2 text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)] focus:outline-none focus:border-[var(--accent-color)]"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={loading || !url.trim() || !name.trim()}
                                className="px-4 py-2 rounded-[var(--radius-2xl)] bg-[var(--accent-color)] text-white font-medium hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {loading ? '添加中...' : '添加'}
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-red-500 text-xs">{error}</p>}
                </div>

                {/* Subscription List */}
                <div className="space-y-3 mt-4">
                    {subscriptions.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-color-secondary)]">
                            暂无订阅
                        </div>
                    )}

                    {subscriptions.map(sub => (
                        <div
                            key={sub.id}
                            className="flex items-center justify-between p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] hover:border-[var(--accent-color)] transition-colors group"
                        >
                            <div className="overflow-hidden mr-4">
                                <h5 className="font-semibold text-[var(--text-color)] truncate">{sub.name}</h5>
                                <p className="text-xs text-[var(--text-color-secondary)] truncate" title={sub.url}>{sub.url}</p>
                                <p className="text-xs text-[var(--text-color-secondary)] mt-1 opacity-70">
                                    上次更新: {new Date(sub.lastUpdated).toLocaleString()}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleRefresh(sub)}
                                    disabled={refreshingIds.has(sub.id)}
                                    className="p-2 rounded-[var(--radius-full)] hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)] text-[var(--text-color)] transition-all"
                                    title="立即更新"
                                >
                                    <svg
                                        className={`w-5 h-5 ${refreshingIds.has(sub.id) ? 'animate-spin text-[var(--accent-color)]' : ''}`}
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <path d="M23 4v6h-6" />
                                        <path d="M1 20v-6h6" />
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                    </svg>
                                </button>

                                <button
                                    onClick={() => onRemove(sub.id)}
                                    className="p-2 rounded-[var(--radius-full)] hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--text-color-secondary)] hover:text-red-500 transition-all"
                                    title="删除订阅"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
