'use client';

import { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';
import { Icons } from '@/components/ui/Icon';
import { userSourcesStore, type DanmakuApiEntry } from '@/lib/store/user-sources-store';
import { settingsStore } from '@/lib/store/settings-store';
import { hasPermission } from '@/lib/store/auth-store';

export function UserDanmakuSettings() {
  const [apis, setApis] = useState<DanmakuApiEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [systemApiUrl, setSystemApiUrl] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const state = userSourcesStore.getState();
    setApis(state.danmakuApis);
    setActiveId(state.activeDanmakuApiId);
    setSystemApiUrl(settingsStore.getSettings().danmakuApiUrl);

    const unsub = userSourcesStore.subscribe(() => {
      const s = userSourcesStore.getState();
      setApis(s.danmakuApis);
      setActiveId(s.activeDanmakuApiId);
    });
    const unsub2 = settingsStore.subscribe(() => {
      setSystemApiUrl(settingsStore.getSettings().danmakuApiUrl);
    });
    return () => { unsub(); unsub2(); };
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('名称和 URL 不能为空');
      return;
    }
    try {
      new URL(url);
    } catch {
      setError('请输入有效的 URL');
      return;
    }
    const id = `danmaku-${Date.now().toString(36)}`;
    userSourcesStore.addDanmakuApi({ id, name: name.trim(), url: url.trim() });
    setName('');
    setUrl('');
    setError('');
  };

  return (
    <SettingsSection title="弹幕 API" description="管理你的弹幕 API，选择当前使用的 API。">
      <div className="space-y-4">
        {/* Add form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="API 名称"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="flex-1 px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
            />
            <input
              type="text"
              placeholder="API URL (https://...)"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              className="flex-[2] px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] text-sm font-medium hover:brightness-110 transition-all cursor-pointer flex items-center gap-1"
            >
              <Icons.Plus size={14} />
              添加
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </form>

        {/* API list with radio select */}
        <div className="space-y-2">
          {/* System default option */}
          <button
            onClick={() => userSourcesStore.setActiveDanmakuApi(null)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 bg-[var(--glass-bg)] border rounded-[var(--radius-2xl)] text-left transition-all cursor-pointer ${activeId === null ? 'border-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)]' : 'border-[var(--glass-border)]'
              }`}
          >
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activeId === null ? 'border-[var(--accent-color)]' : 'border-[var(--glass-border)]'
              }`}>
              {activeId === null && <span className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-color)]">使用系统默认</p>
              {systemApiUrl && (
                <p className="text-[10px] text-[var(--text-color-secondary)] truncate">
                  {hasPermission('danmaku_api') ? systemApiUrl : '内置 API'}
                </p>
              )}
              {!systemApiUrl && (
                <p className="text-[10px] text-[var(--text-color-secondary)]">未配置系统弹幕 API</p>
              )}
            </div>
          </button>

          {apis.map(api => (
            <div key={api.id} className={`flex items-center gap-3 px-4 py-2.5 bg-[var(--glass-bg)] border rounded-[var(--radius-2xl)] ${activeId === api.id ? 'border-[var(--accent-color)] bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)]' : 'border-[var(--glass-border)]'
              }`}>
              <button
                onClick={() => userSourcesStore.setActiveDanmakuApi(api.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activeId === api.id ? 'border-[var(--accent-color)]' : 'border-[var(--glass-border)]'
                  }`}>
                  {activeId === api.id && <span className="w-2 h-2 rounded-full bg-[var(--accent-color)]" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-color)] truncate">{api.name}</p>
                  <p className="text-[10px] text-[var(--text-color-secondary)] truncate">{api.url}</p>
                </div>
              </button>
              <button
                onClick={() => userSourcesStore.removeDanmakuApi(api.id)}
                className="p-1 text-[var(--text-color-secondary)] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0"
              >
                <Icons.Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
