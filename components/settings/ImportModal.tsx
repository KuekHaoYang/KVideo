'use client';

import { useState, useEffect } from 'react';
import { ImportModalTabs } from './import/ImportModalTabs';
import { FileImportTab } from './import/FileImportTab';
import { LinkImportTab } from './import/LinkImportTab';
import { SubscriptionImportTab } from './import/SubscriptionImportTab';
import { JsonImportTab } from './import/JsonImportTab';
import type { ImportResult } from '@/lib/utils/source-import-utils';
import type { SourceSubscription } from '@/lib/types';
import { ModalBackdrop } from '@/components/ui/ModalBackdrop';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // File Import Handler
  onImportFile: (jsonString: string) => Promise<boolean> | boolean;
  // Link Import Handler 
  onImportLink: (result: ImportResult) => Promise<boolean> | boolean;
  // Subscription Handlers
  subscriptions: SourceSubscription[];
  onAddSubscription: (sub: SourceSubscription) => Promise<boolean> | boolean;
  onRemoveSubscription: (id: string) => void;
  onRefreshSubscription: (sub: SourceSubscription) => Promise<void>;
}

export function ImportModal({
  isOpen,
  onClose,
  onImportFile,
  onImportLink,
  subscriptions,
  onAddSubscription,
  onRemoveSubscription,
  onRefreshSubscription
}: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'link' | 'subscription' | 'json'>('file');

  // Reset tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('file');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <ModalBackdrop isOpen={isOpen} onClose={onClose} />

      {/* Modal */}
      <div
        className={`fixed top-1/2 left-1/2 z-[9999] w-[90%] max-w-md -translate-x-1/2 transition-all duration-300 ${isOpen
            ? 'opacity-100 -translate-y-1/2 scale-100'
            : 'opacity-0 -translate-y-[40%] scale-95 pointer-events-none'
          }`}
      >
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-md)] p-6 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h3 className="text-xl font-semibold text-[var(--text-color)]">
              导入设置
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200"
              aria-label="关闭"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <ImportModalTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 min-h-0">
            {activeTab === 'file' && (
              <FileImportTab onImport={onImportFile} />
            )}

            {activeTab === 'link' && (
              <LinkImportTab onImport={onImportLink} />
            )}

            {activeTab === 'subscription' && (
              <SubscriptionImportTab
                subscriptions={subscriptions}
                onAdd={onAddSubscription}
                onRemove={onRemoveSubscription}
                onRefresh={onRefreshSubscription}
              />
            )}

            {activeTab === 'json' && (
              <JsonImportTab />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
