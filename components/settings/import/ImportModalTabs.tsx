'use client';

interface ImportModalTabsProps {
    activeTab: 'file' | 'link' | 'subscription' | 'json';
    onTabChange: (tab: 'file' | 'link' | 'subscription' | 'json') => void;
}

export function ImportModalTabs({ activeTab, onTabChange }: ImportModalTabsProps) {
    const tabs = [
        { id: 'file', label: '文件导入' },
        { id: 'link', label: '链接导入' },
        { id: 'subscription', label: '订阅管理' },
        { id: 'json', label: 'JSON' },
    ] as const;

    return (
        <div className="relative mb-6">
            <div className="flex border-b border-[var(--glass-border)] relative overflow-x-auto whitespace-nowrap no-scrollbar w-full">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
              relative px-5 py-3 text-sm font-medium transition-colors duration-200
              ${activeTab === tab.id
                                ? 'text-[var(--text-color)] font-semibold'
                                : 'text-[var(--text-color-secondary)] hover:text-[var(--text-color)]'}
            `}
                    >
                        {tab.label}
                        {/* Active Indicator */}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-color)] rounded-t-full shadow-[0_0_8px_var(--accent-color)]" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
