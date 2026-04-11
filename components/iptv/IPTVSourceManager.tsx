'use client';

/**
 * IPTVSourceManager - Admin UI to manage M3U playlist sources
 */

import { useState } from 'react';
import { useIPTVStore, type IPTVSource } from '@/lib/store/iptv-store';
import { Icons } from '@/components/ui/Icon';
import { hasPermission } from '@/lib/store/auth-store';

const inputProps = {
  spellCheck: false,
  autoCorrect: 'off' as const,
  autoCapitalize: 'off' as const,
  autoComplete: 'off' as const,
  'data-form-type': 'other',
  'data-lpignore': 'true',
  lang: 'en',
  translate: 'no' as const,
};

export function IPTVSourceManager() {
  const { sources, addSource, removeSource, updateSource, refreshSources, isLoading } = useIPTVStore();
  const canUseBuiltinSources = hasPermission('iptv_builtin_sources');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const visibleSources = sources.filter((source) => canUseBuiltinSources || source.kind !== 'builtin');

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    addSource(name.trim(), url.trim());
    setName('');
    setUrl('');
    setShowAdd(false);
    // Auto-refresh after adding (only if not already loading)
    if (!isLoading) {
      setTimeout(() => refreshSources(), 100);
    }
  };

  const startEdit = (source: IPTVSource) => {
    setEditingId(source.id);
    setEditName(source.name);
    setEditUrl(source.url);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditUrl('');
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim() || !editUrl.trim()) return;
    updateSource(editingId, { name: editName.trim(), url: editUrl.trim() });
    setEditingId(null);
    setEditName('');
    setEditUrl('');
    // Auto-refresh after editing
    if (!isLoading) {
      setTimeout(() => refreshSources(), 100);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-color)]">
          直播源管理
        </h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => refreshSources()}
            disabled={isLoading || visibleSources.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icons.RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] hover:opacity-90 transition-all cursor-pointer"
          >
            <Icons.Plus size={12} />
            添加源
          </button>
        </div>
      </div>

      {/* Add Source Form */}
      {showAdd && (
        <div className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] space-y-3">
          <input
            type="text"
            placeholder="源名称（如：我的IPTV）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...inputProps}
            className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <input
            type="text"
            placeholder="M3U / JSON 链接地址"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            {...inputProps}
            className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-color-secondary)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim() || !url.trim()}
              className="px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] hover:opacity-90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* Source List */}
      {visibleSources.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-color-secondary)]">
          暂无直播源，请添加 M3U 或 JSON 播放列表链接
        </div>
      ) : (
        <div className="space-y-2">
          {visibleSources.map((source) => (
            <div
              key={source.id}
              className="p-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]"
            >
              {editingId === source.id ? (
                /* Edit Mode */
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    {...inputProps}
                    className="w-full px-3 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                  />
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    {...inputProps}
                    className="w-full px-3 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 text-xs text-[var(--text-color-secondary)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim() || !editUrl.trim()}
                      className="px-3 py-1 text-xs bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] hover:opacity-90 transition-all cursor-pointer disabled:opacity-40"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                /* Display Mode */
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-color)] truncate">{source.name}</p>
                      {source.kind === 'builtin' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                          内置
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-color-secondary)] truncate">{source.url}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {source.kind !== 'builtin' ? (
                      <>
                        <button
                          onClick={() => startEdit(source)}
                          className="p-1.5 text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
                          title="编辑"
                        >
                          <Icons.Edit size={14} />
                        </button>
                        <button
                          onClick={() => removeSource(source.id)}
                          className="p-1.5 text-[var(--text-color-secondary)] hover:text-red-500 transition-colors cursor-pointer"
                          title="删除"
                        >
                          <Icons.Trash size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-[var(--text-color-secondary)] px-2">
                        环境变量提供
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
