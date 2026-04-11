'use client';

import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui/Icon';

interface FavoritesPageHeaderProps {
  count: number;
  sortBy: 'date' | 'title';
  onSortChange: (sort: 'date' | 'title') => void;
  onClearAll: () => void;
}

export function FavoritesPageHeader({
  count,
  sortBy,
  onSortChange,
  onClearAll
}: FavoritesPageHeaderProps) {
  const router = useRouter();

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-[var(--accent-color)] hover:underline mb-4 cursor-pointer"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        返回上一页
      </button>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)]">
            <Icons.Heart size={24} className="text-[var(--text-color)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-color)]">我的收藏</h1>
            <p className="text-[var(--text-color-secondary)]">
              共 {count} 个视频
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort buttons */}
          <div className="flex items-center gap-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] p-1">
            <button
              onClick={() => onSortChange('date')}
              className={`px-3 py-1.5 rounded-[var(--radius-full)] text-sm transition-all ${
                sortBy === 'date'
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
              }`}
            >
              最新添加
            </button>
            <button
              onClick={() => onSortChange('title')}
              className={`px-3 py-1.5 rounded-[var(--radius-full)] text-sm transition-all ${
                sortBy === 'title'
                  ? 'bg-[var(--accent-color)] text-white'
                  : 'text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
              }`}
            >
              标题排序
            </button>
          </div>

          {/* Clear all button */}
          {count > 0 && (
            <button
              onClick={onClearAll}
              className="px-4 py-2 rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all text-sm flex items-center gap-2"
            >
              <Icons.Trash size={16} />
              清空收藏
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
