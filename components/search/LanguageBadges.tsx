/**
 * LanguageBadges - Language filter badge component
 * Mirrors TypeBadges pattern, reuses TypeBadgeItem for individual badges
 */

'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/Card';
import { Icons } from '@/components/ui/Icon';
import { TypeBadgeItem } from './TypeBadgeItem';
import type { LanguageBadge } from '@/lib/types';

interface LanguageBadgesProps {
  badges: LanguageBadge[];
  selectedLangs: Set<string>;
  onToggleLang: (lang: string) => void;
  className?: string;
}

export const LanguageBadges = memo(function LanguageBadges({
  badges,
  selectedLangs,
  onToggleLang,
  className = ''
}: LanguageBadgesProps) {
  if (badges.length === 0) {
    return null;
  }

  const handleClearAll = () => {
    selectedLangs.forEach(lang => onToggleLang(lang));
  };

  return (
    <Card
      hover={false}
      className={`p-4 animate-fade-in bg-[var(--bg-color)]/50 backdrop-blur-none saturate-100 shadow-sm border-[var(--glass-border)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Icons.Languages size={16} className="text-[var(--accent-color)]" />
          <span className="text-sm font-semibold text-[var(--text-color)]">
            语言标签 ({badges.length}):
          </span>
        </div>

        {/* Desktop: flex wrap, Mobile: horizontal scroll */}
        <div className="hidden md:flex md:flex-1 -mx-1 px-1">
          <div className="flex items-center gap-2 flex-wrap p-1">
            {badges.map((badge) => (
              <TypeBadgeItem
                key={badge.lang}
                type={badge.lang}
                count={badge.count}
                isSelected={selectedLangs.has(badge.lang)}
                onToggle={() => onToggleLang(badge.lang)}
              />
            ))}
          </div>
        </div>

        <div className="flex md:hidden flex-1 -mx-1 px-1 overflow-hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {badges.map((badge) => (
              <TypeBadgeItem
                key={badge.lang}
                type={badge.lang}
                count={badge.count}
                isSelected={selectedLangs.has(badge.lang)}
                onToggle={() => onToggleLang(badge.lang)}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedLangs.size > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
          <button
            onClick={handleClearAll}
            className="text-xs text-[var(--text-color-secondary)] hover:text-[var(--accent-color)]
                     flex items-center gap-1 transition-colors"
          >
            <Icons.X size={12} />
            清除筛选 ({selectedLangs.size})
          </button>
        </div>
      )}
    </Card>
  );
});
