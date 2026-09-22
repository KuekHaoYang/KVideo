'use client';

/**
 * /sources - Source Browser
 *
 * Lists every configured video source (normal + premium) with its name, type,
 * and current latency/health. A search input filters by source name; each row
 * links to a representative "热门" search on the home page.
 *
 * Follows the existing Liquid Glass design language (var(--glass-bg),
 * var(--text-color), etc.) and is responsive on mobile + desktop.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icon';
import { LatencyBadge } from '@/components/ui/LatencyBadge';
import { Navbar } from '@/components/layout/Navbar';
import { useLatencyPing } from '@/lib/hooks/useLatencyPing';
import { settingsStore } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';
import {
  buildSourceSearchHref,
  describeSourceType,
  filterSourcesByName,
} from '@/lib/utils/source-browser';

export default function SourcesPage() {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [query, setQuery] = useState('');
  // Stable tick to force useLatencyPing to re-read when settings change.
  const [, setSettingsVersion] = useState(0);

  // Initial load + subscribe to settings changes (sources may be edited).
  useEffect(() => {
    const refresh = () => {
      const settings = settingsStore.getSettings();
      setSources([...settings.sources, ...settings.premiumSources]);
      setSettingsVersion((v) => v + 1);
    };
    refresh();
    return settingsStore.subscribe(refresh);
  }, []);

  const sourceUrls = useMemo(
    () =>
      sources
        .filter((s) => s.baseUrl)
        .map((s) => ({ id: s.id, baseUrl: s.baseUrl })),
    [sources],
  );

  const { latencies, isLoading, refreshAll } = useLatencyPing({
    sourceUrls,
    enabled: true,
  });

  const filtered = useMemo(
    () => filterSourcesByName(sources, query),
    [sources, query],
  );

  const handleReset = useCallback(() => {
    setQuery('');
  }, []);

  const totalCount = sources.length;
  const visibleCount = filtered.length;

  return (
    <div className="min-h-screen">
      <Navbar onReset={handleReset} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        <div className="mb-6">
          <h1
            className="text-2xl sm:text-3xl font-bold text-[var(--text-color)]"
            data-testid="sources-page-title"
          >
            源浏览
          </h1>
          <p className="mt-1 text-sm text-[var(--text-color-secondary)]">
            查看当前所有已配置的影片源及其延迟状态。
          </p>
        </div>

        <div
          className="bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--shadow-sm)] rounded-[var(--radius-2xl)] p-4 sm:p-6"
          data-testid="sources-browser-card"
        >
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">按名称筛选</span>
              <Icons.Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-color-secondary)] pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="按源名称筛选…"
                aria-label="按源名称筛选"
                data-testid="sources-filter-input"
                className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-full)] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)] focus:outline-none focus:border-[var(--accent-color)] transition-colors"
              />
            </label>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <span
                className="text-xs text-[var(--text-color-secondary)] tabular-nums"
                data-testid="sources-count"
              >
                {visibleCount}/{totalCount} 个源
              </span>
              <button
                type="button"
                onClick={() => refreshAll()}
                disabled={isLoading}
                aria-label="刷新延迟"
                title="刷新延迟"
                data-testid="sources-refresh"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-full)] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Icons.RefreshCw
                  size={12}
                  className={isLoading ? 'animate-spin' : ''}
                />
                <span>刷新延迟</span>
              </button>
            </div>
          </div>

          {/* Empty state */}
          {totalCount === 0 && (
            <div
              className="text-center py-12 text-sm text-[var(--text-color-secondary)]"
              data-testid="sources-empty"
            >
              当前未配置任何影片源，请前往
              <Link
                href="/settings"
                className="mx-1 text-[var(--accent-color)] hover:underline"
              >
                设置
              </Link>
              添加。
            </div>
          )}

          {/* No match state */}
          {totalCount > 0 && visibleCount === 0 && (
            <div
              className="text-center py-12 text-sm text-[var(--text-color-secondary)]"
              data-testid="sources-no-match"
            >
              没有匹配 “{query}” 的源。
            </div>
          )}

          {/* Source list */}
          {visibleCount > 0 && (
            <ul
              className="flex flex-col divide-y divide-[var(--glass-border)]"
              data-testid="sources-list"
            >
              {filtered.map((source) => {
                const latency = latencies[source.id];
                const hasBaseUrl = Boolean(source.baseUrl);
                return (
                  <li
                    key={source.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3"
                    data-testid="source-row"
                    data-source-id={source.id}
                    data-source-name={source.name}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-[var(--radius-full)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-[var(--accent-color)] flex-shrink-0">
                        <Icons.Globe size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[var(--text-color)] truncate">
                            {source.name}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-full)] text-[10px] font-medium border border-[var(--glass-border)] text-[var(--text-color-secondary)]">
                            <Icons.Tag size={10} />
                            {describeSourceType(source)}
                          </span>
                          {source.enabled === false && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-full)] text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                              已禁用
                            </span>
                          )}
                        </div>
                        {hasBaseUrl && (
                          <div className="text-xs text-[var(--text-color-secondary)] truncate mt-0.5">
                            {source.baseUrl}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-shrink-0 pl-11 sm:pl-0">
                      {latency !== undefined ? (
                        <LatencyBadge latency={latency} />
                      ) : (
                        <span className="text-xs text-[var(--text-color-secondary)]">
                          未探测
                        </span>
                      )}
                      <Link
                        href={buildSourceSearchHref(source.name)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-[var(--radius-full)] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] hover:border-[var(--accent-color)] transition-colors"
                        aria-label={`使用 ${source.name} 搜索热门`}
                        data-testid="source-search-link"
                      >
                        <span>查看</span>
                        <Icons.ExternalLink size={12} />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
