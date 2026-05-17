'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import type { AppReleaseEntry, AppUpdateResponse } from '@/lib/types/app-update';

const DEFAULT_SOURCE = {
  repository: 'KuekHaoYang/KVideo',
  branch: 'main',
  manifestUrl: 'https://raw.githubusercontent.com/KuekHaoYang/KVideo/main/app-release.json',
  changelogUrl: 'https://github.com/KuekHaoYang/KVideo/blob/main/CHANGELOG.md',
  repositoryUrl: 'https://github.com/KuekHaoYang/KVideo',
};

function formatDateLabel(value?: string) {
  if (!value) {
    return '未记录';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function getStatusMeta(data: AppUpdateResponse | null) {
  switch (data?.status) {
    case 'update-available':
      return {
        label: '发现新版本',
        tone: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
        description: `GitHub 最新版本为 ${data.latestVersion}，当前实例仍是 ${data.currentVersion}。`,
      };
    case 'ahead-of-remote':
      return {
        label: '本地版本较新',
        tone: 'text-sky-500 border-sky-500/30 bg-sky-500/10',
        description: `当前实例版本 ${data.currentVersion} 新于 GitHub 检查结果 ${data.latestVersion}。`,
      };
    case 'check-failed':
      return {
        label: '检查失败',
        tone: 'text-red-500 border-red-500/30 bg-red-500/10',
        description: data.error || '远程版本检查失败，当前仅显示本地版本信息。',
      };
    case 'up-to-date':
    default:
      return {
        label: '已是最新版本',
        tone: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
        description: data
          ? `当前实例版本 ${data.currentVersion} 与 GitHub 最新版本一致。`
          : '正在获取最新版本信息。',
      };
  }
}

function ReleaseNotesBlock({
  title,
  release,
  emptyText,
}: {
  title: string;
  release: AppReleaseEntry | null;
  emptyText: string;
}) {
  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_55%,transparent)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-color)]">{title}</h3>
          {release ? (
            <p className="mt-1 text-xs text-[var(--text-color-secondary)]">
              {release.version} · {release.title} · {release.publishedAt}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-color-secondary)]">{emptyText}</p>
          )}
        </div>
      </div>

      {release ? (
        <ul className="mt-4 space-y-2">
          {release.notes.map((note) => (
            <li key={note} className="flex items-start gap-2 text-sm text-[var(--text-color-secondary)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-color)]" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AppVersionSettings() {
  const [data, setData] = useState<AppUpdateResponse | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUpdateInfo = useCallback(async (manual: boolean = false) => {
    if (manual) {
      setIsRefreshing(true);
    }

    try {
      const response = await fetch('/api/app-update', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AppUpdateResponse;
      setData(payload);
      setHasLoaded(true);
    } catch (error) {
      setHasLoaded(true);
      setData((previous) => ({
        currentVersion: previous?.currentVersion || '未知',
        currentRelease: previous?.currentRelease || null,
        latestVersion: previous?.latestVersion || previous?.currentVersion || '未知',
        latestRelease: previous?.latestRelease || previous?.currentRelease || null,
        status: 'check-failed',
        updateAvailable: false,
        checkedAt: new Date().toISOString(),
        checkedRemotely: false,
        usedRemoteManifest: false,
        source: previous?.source || DEFAULT_SOURCE,
        error: error instanceof Error ? error.message : '未知错误',
      }));
    } finally {
      if (manual) {
        setIsRefreshing(false);
        }
      }
  }, []);

  useEffect(() => {
    void fetchUpdateInfo(false);
  }, [fetchUpdateInfo]);

  const handleRefresh = () => {
    void fetchUpdateInfo(true);
  };

  const statusMeta = getStatusMeta(data);
  const currentRelease = data?.currentRelease ?? null;
  const latestRelease = data?.latestRelease ?? null;
  const shouldShowLatestRelease = Boolean(
    latestRelease && (!currentRelease || latestRelease.version !== currentRelease.version),
  );

  return (
    <SettingsSection
      title="版本与更新"
      description="查看当前版本、最近更新内容，并手动检查 GitHub 上是否已有新版本。"
      headerAction={
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-[var(--radius-full)] border border-[var(--glass-border)] px-4 py-2 text-sm font-medium text-[var(--text-color)] transition-all duration-200 hover:bg-[color-mix(in_srgb,var(--accent-color)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          检查更新
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--accent-color)_7%,transparent)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-color-secondary)]">当前版本</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-color)]">{data?.currentVersion || '加载中...'}</p>
            <p className="mt-2 text-sm text-[var(--text-color-secondary)]">
              {currentRelease ? `${currentRelease.title} · ${currentRelease.publishedAt}` : '正在读取本地版本说明'}
            </p>
          </div>

          <div className="rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-color)_55%,transparent)] p-4">
            <div className={`inline-flex rounded-[var(--radius-full)] border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}>
              {statusMeta.label}
            </div>
            <p className="mt-3 text-sm text-[var(--text-color-secondary)]">{statusMeta.description}</p>
            <p className="mt-2 text-xs text-[var(--text-color-secondary)]">
              上次检查：{hasLoaded ? formatDateLabel(data?.checkedAt) : '正在检查'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-color-secondary)]">
          <span>
            检查来源：{data?.source.repository || 'KuekHaoYang/KVideo'} · {data?.source.branch || 'main'}
          </span>
          <Link
            href={data?.source.changelogUrl || 'https://github.com/KuekHaoYang/KVideo/blob/main/CHANGELOG.md'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent-color)] hover:underline"
          >
            查看更新日志
            <ExternalLink size={12} />
          </Link>
          <Link
            href={data?.source.repositoryUrl || 'https://github.com/KuekHaoYang/KVideo'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent-color)] hover:underline"
          >
            查看仓库
            <ExternalLink size={12} />
          </Link>
        </div>

        <ReleaseNotesBlock
          title="当前版本更新内容"
          release={currentRelease}
          emptyText="当前版本尚未记录更新内容。"
        />

        {shouldShowLatestRelease ? (
          <ReleaseNotesBlock
            title={`最新可用版本 ${latestRelease?.version}`}
            release={latestRelease}
            emptyText="最新版本尚未提供更新说明。"
          />
        ) : null}
      </div>
    </SettingsSection>
  );
}
