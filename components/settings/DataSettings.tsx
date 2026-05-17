interface DataSettingsProps {
    onExport: () => void;
    onImport: () => void;
    onReset: () => void;
}

export function DataSettings({ onExport, onImport, onReset }: DataSettingsProps) {
    return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-color)] mb-4">数据管理</h2>
            <div className="space-y-3">
                <button
                    onClick={onExport}
                    className="w-full px-6 py-4 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] font-medium hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 flex items-center justify-between cursor-pointer"
                >
                    <span>导出设置</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                </button>

                <button
                    onClick={onImport}
                    className="w-full px-6 py-4 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] font-medium hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 flex items-center justify-between cursor-pointer"
                >
                    <span>导入设置</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                </button>
            </div>

            <div className="mt-6 rounded-[var(--radius-2xl)] border border-red-200/80 bg-red-50/80 p-4 dark:border-red-900/60 dark:bg-red-950/20">
                <div className="mb-3">
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">危险操作</h3>
                    <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                        这会删除本地设置、历史、收藏，并同时请求服务端清除当前登录会话。
                    </p>
                </div>

                <button
                    onClick={onReset}
                    className="w-full px-6 py-4 rounded-[var(--radius-2xl)] bg-red-600 border border-red-700 text-white font-medium hover:bg-red-700 transition-all duration-200 flex items-center justify-between cursor-pointer"
                >
                    <span>清除所有数据</span>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
