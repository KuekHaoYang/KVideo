/**
 * FavoritesSidebar - Main favorites sidebar component
 * Positioned on the left side of the screen (opposite to WatchHistorySidebar)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useFavorites } from '@/lib/store/favorites-store';
import { WatchHistorySidebar } from '@/components/history/WatchHistorySidebar';
import { Icons } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FavoritesHeader } from './FavoritesHeader';
import { FavoritesList } from './FavoritesList';
import { FavoritesFooter } from './FavoritesFooter';
import { trapFocus } from '@/lib/accessibility/focus-management';
import { useFloatingButtonPosition } from '@/lib/hooks/useFloatingButtonPosition';

export function FavoritesSidebar({ isPremium = false }: { isPremium?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        videoId?: string;
        source?: string;
        isClearAll?: boolean;
    }>({ isOpen: false });
    const { favorites, removeFavorite, clearFavorites } = useFavorites(isPremium);
    const sidebarRef = useRef<HTMLElement>(null);
    const cleanupFocusTrapRef = useRef<(() => void) | null>(null);
    const {
        floatingStyle,
        onPointerDown,
        consumeSyntheticClick,
    } = useFloatingButtonPosition({
        storageKey: isPremium ? 'kvideo-premium-favorites-button-position' : 'kvideo-favorites-button-position',
        defaultAnchor: 'left',
    });

    // Setup focus trap when sidebar opens
    useEffect(() => {
        if (isOpen && sidebarRef.current) {
            cleanupFocusTrapRef.current = trapFocus(sidebarRef.current);
        }

        return () => {
            if (cleanupFocusTrapRef.current) {
                cleanupFocusTrapRef.current();
                cleanupFocusTrapRef.current = null;
            }
        };
    }, [isOpen]);

    // Handle escape key to close sidebar
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    // Handle delete confirmation
    const handleDeleteItem = (videoId: string | number, source: string) => {
        setDeleteConfirm({ isOpen: true, videoId: String(videoId), source });
    };

    const handleClearAll = () => {
        setDeleteConfirm({ isOpen: true, isClearAll: true });
    };

    const confirmDelete = () => {
        if (deleteConfirm.isClearAll) {
            clearFavorites();
        } else if (deleteConfirm.videoId && deleteConfirm.source) {
            removeFavorite(deleteConfirm.videoId, deleteConfirm.source);
        }
        setDeleteConfirm({ isOpen: false });
    };

    const cancelDelete = () => {
        setDeleteConfirm({ isOpen: false });
    };

    return (
        <>
            {/* Toggle Button - Left side */}
            <button
                onClick={(event) => {
                    if (consumeSyntheticClick(event)) return;
                    setIsOpen(true);
                }}
                onPointerDown={onPointerDown}
                style={floatingStyle}
                className="fixed z-40 bg-[var(--glass-bg)] backdrop-blur-[8px] saturate-[120%] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-md)] p-3 hover:scale-105 transition-transform duration-200 cursor-pointer touch-none select-none"
                aria-label="打开收藏夹"
                title="点击打开收藏夹，拖动可调整位置"
            >
                <Icons.Heart size={24} className="text-[var(--text-color)]" />
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1999] bg-black/40 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar - Left side */}
            <aside
                ref={sidebarRef}
                role="complementary"
                aria-labelledby="favorites-sidebar-title"
                aria-hidden={!isOpen}
                style={{
                    transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)',
                    willChange: isOpen ? 'transform' : 'auto'
                }}
                className={`fixed top-0 left-0 bottom-0 w-[85%] sm:w-[90%] max-w-[420px] z-[2000] bg-[var(--glass-bg)] backdrop-blur-[8px] saturate-[120%] border-r border-[var(--glass-border)] rounded-tr-[var(--radius-2xl)] rounded-br-[var(--radius-2xl)] p-6 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-transform duration-250 ease-out`}
            >
                <FavoritesHeader onClose={() => setIsOpen(false)} />

                <FavoritesList
                    favorites={favorites}
                    onRemove={handleDeleteItem}
                    isPremium={isPremium}
                />

                <FavoritesFooter
                    hasFavorites={favorites.length > 0}
                    onClearAll={handleClearAll}
                />
            </aside>

            {/* Watch History Sidebar - Right side */}
            <WatchHistorySidebar isPremium={isPremium} />

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title={deleteConfirm.isClearAll ? '清空收藏夹' : '取消收藏'}
                message={
                    deleteConfirm.isClearAll
                        ? '确定要清空所有收藏吗？此操作无法撤销。'
                        : '确定要取消收藏这个视频吗？'
                }
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                confirmText="确定"
                cancelText="取消"
                variant="danger"
            />
        </>
    );
}
