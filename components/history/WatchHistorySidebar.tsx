/**
 * Watch History Sidebar Component
 * 观看历史侧边栏组件 - Main layout and state management
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useHistory } from '@/lib/store/history-store';
import { Icons } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { HistoryHeader } from './HistoryHeader';
import { HistoryList } from './HistoryList';
import { HistoryFooter } from './HistoryFooter';
import { trapFocus } from '@/lib/accessibility/focus-management';
import { useFloatingButtonPosition } from '@/lib/hooks/useFloatingButtonPosition';

export function WatchHistorySidebar({ isPremium = false }: { isPremium?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    showIdentifier?: string;
    isClearAll?: boolean;
  }>({ isOpen: false });
  const { viewingHistory, removeFromHistory, clearHistory } = useHistory(isPremium);
  const sidebarRef = useRef<HTMLElement>(null);
  const cleanupFocusTrapRef = useRef<(() => void) | null>(null);
  const {
    floatingStyle,
    onPointerDown,
    consumeSyntheticClick,
  } = useFloatingButtonPosition({
    storageKey: isPremium ? 'kvideo-premium-history-button-position' : 'kvideo-history-button-position',
    defaultAnchor: 'right',
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
  const handleDeleteItem = (showIdentifier: string) => {
    setDeleteConfirm({ isOpen: true, showIdentifier });
  };

  const handleClearAll = () => {
    setDeleteConfirm({ isOpen: true, isClearAll: true });
  };

  const confirmDelete = () => {
    if (deleteConfirm.isClearAll) {
      clearHistory();
    } else if (deleteConfirm.showIdentifier) {
      removeFromHistory(deleteConfirm.showIdentifier);
    }
    setDeleteConfirm({ isOpen: false });
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={(event) => {
          if (consumeSyntheticClick(event)) return;
          setIsOpen(true);
        }}
        onPointerDown={onPointerDown}
        style={floatingStyle}
        className="fixed z-40 bg-[var(--glass-bg)] backdrop-blur-[8px] saturate-[120%] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-md)] p-3 hover:scale-105 transition-transform duration-200 cursor-pointer touch-none select-none"
        aria-label="打开观看历史"
        title="点击打开观看历史，拖动可调整位置"
      >
        <Icons.History size={24} className="text-[var(--text-color)]" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[1999] bg-black/40 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        role="complementary"
        aria-labelledby="history-sidebar-title"
        aria-hidden={!isOpen}
        style={{
          transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)',
          willChange: isOpen ? 'transform' : 'auto'
        }}
        className={`fixed top-0 right-0 bottom-0 w-[85%] sm:w-[90%] max-w-[420px] z-[2000] bg-[var(--glass-bg)] backdrop-blur-[8px] saturate-[120%] border-l border-[var(--glass-border)] rounded-tl-[var(--radius-2xl)] rounded-bl-[var(--radius-2xl)] p-6 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-transform duration-250 ease-out`}
      >
        <HistoryHeader onClose={() => setIsOpen(false)} />

        <HistoryList
          history={viewingHistory}
          onRemove={handleDeleteItem}
          isPremium={isPremium}
        />

        <HistoryFooter
          hasHistory={viewingHistory.length > 0}
          onClearAll={handleClearAll}
        />
      </aside>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.isClearAll ? '清空历史记录' : '删除历史记录'}
        message={
          deleteConfirm.isClearAll
            ? '确定要清空所有观看历史吗？此操作无法撤销。'
            : '确定要删除这条历史记录吗？'
        }
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </>
  );
}
