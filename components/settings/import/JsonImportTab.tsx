'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/Icon';
import { settingsStore } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

export function JsonImportTab() {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<VideoSource[] | null>(null);
  const [imported, setImported] = useState(false);

  const handleParse = () => {
    setError('');
    setPreview(null);
    if (!jsonText.trim()) {
      setError('请粘贴 JSON 内容');
      return;
    }

    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        setError('JSON 格式错误：应为数组');
        return;
      }

      const sources: VideoSource[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.name || !item.baseUrl) {
          setError(`第 ${i + 1} 项缺少 name 或 baseUrl`);
          return;
        }
        sources.push({
          id: item.id || `json-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${i}`,
          name: item.name,
          baseUrl: item.baseUrl,
          searchPath: item.searchPath || '/provide/vod',
          detailPath: item.detailPath || '/provide/vod',
          enabled: item.enabled !== false,
          headers: item.headers,
          priority: item.priority,
          group: item.group,
        });
      }

      if (sources.length === 0) {
        setError('没有有效的视频源');
        return;
      }

      setPreview(sources);
    } catch (e) {
      setError('JSON 解析失败：' + (e instanceof Error ? e.message : '格式错误'));
    }
  };

  const handleImport = () => {
    if (!preview) return;

    const settings = settingsStore.getSettings();
    const existingIds = new Set(settings.sources.map(s => s.id));
    const newSources = preview.filter(s => !existingIds.has(s.id));
    const updatedSources = [...settings.sources, ...newSources];
    settingsStore.saveSettings({ ...settings, sources: updatedSources });
    setImported(true);
    setPreview(null);
    setJsonText('');
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-color-secondary)]">
        粘贴 JSON 数组格式的视频源配置。格式：
        <code className="block mt-1 px-2 py-1 bg-black/10 rounded text-[10px]">
          {'[{ "name": "...", "baseUrl": "..." }]'}
        </code>
      </p>

      <textarea
        value={jsonText}
        onChange={(e) => { setJsonText(e.target.value); setError(''); setPreview(null); setImported(false); }}
        placeholder='[{ "name": "源名称", "baseUrl": "https://..." }]'
        rows={6}
        className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)] font-mono resize-none"
      />

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {!preview && !imported && (
        <button
          onClick={handleParse}
          className="w-full px-4 py-2.5 bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] text-sm font-medium hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Icons.Search size={14} />
          解析预览
        </button>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="p-3 bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
            <p className="text-sm text-[var(--text-color)]">
              解析成功，共 <span className="font-bold text-[var(--accent-color)]">{preview.length}</span> 个视频源
            </p>
            <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
              {preview.map((s, i) => (
                <div key={i} className="text-xs text-[var(--text-color-secondary)] flex gap-2 flex-wrap">
                  <span className="font-medium text-[var(--text-color)]">{s.name}</span>
                  <span className="truncate">{s.baseUrl}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setPreview(null); }}
              className="flex-1 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] rounded-[var(--radius-2xl)] text-sm hover:bg-[var(--glass-hover)] transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              className="flex-1 px-4 py-2 bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] text-sm font-medium hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Icons.Download size={14} />
              导入
            </button>
          </div>
        </div>
      )}

      {imported && (
        <p className="text-xs text-green-500 text-center py-2">导入成功！</p>
      )}
    </div>
  );
}
