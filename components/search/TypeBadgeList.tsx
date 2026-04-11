/**
 * TypeBadgeList - Badge list container with responsive layout
 * Desktop: Expandable grid with show more/less
 * Mobile: Horizontal scroll with snap
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Icons } from '@/components/ui/Icon';
import { TypeBadgeItem } from './TypeBadgeItem';
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation';

const TYPE_EXPAND_KEY = 'kvideo_type_badges_expanded';

interface TypeBadge {
  type: string;
  count: number;
}

interface TypeBadgeListProps {
  badges: TypeBadge[];
  selectedTypes: Set<string>;
  onToggleType: (type: string) => void;
}

export function TypeBadgeList({ badges, selectedTypes, onToggleType }: TypeBadgeListProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(TYPE_EXPAND_KEY);
    return saved !== 'false'; // default to expanded
  });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hasOverflow, setHasOverflow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeContainerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem(TYPE_EXPAND_KEY, String(next));
      return next;
    });
  }, []);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: true,
    containerRef: containerRef,
    currentIndex: focusedIndex,
    itemCount: badges.length,
    orientation: 'horizontal',
    onNavigate: useCallback((index: number) => {
      setFocusedIndex(index);
      badgeRefs.current[index]?.focus();
      // Scroll into view for mobile
      badgeRefs.current[index]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }, []),
    onSelect: useCallback((index: number) => {
      onToggleType(badges[index].type);
    }, [badges, onToggleType]),
  });

  // Check if content has overflow on mount and when badge count changes
  const hasCheckedOverflow = useRef(false);
  useEffect(() => {
    const checkOverflow = () => {
      if (badgeContainerRef.current) {
        const maxHeight = 50; // 50px to fit one row (44px) + padding but hide second row (starts at 52px)
        setHasOverflow(badgeContainerRef.current.scrollHeight > maxHeight);
      }
    };

    checkOverflow();
    // Only do delayed recheck on first measurement
    if (!hasCheckedOverflow.current) {
      hasCheckedOverflow.current = true;
      const timeout = setTimeout(checkOverflow, 100);
      return () => clearTimeout(timeout);
    }
  }, [badges.length]);

  return (
    <>
      {/* Desktop: Expandable Grid */}
      <div
        ref={containerRef}
        className="hidden md:flex md:flex-col md:flex-1 -mx-1 px-1"
        role="group"
        aria-label="类型筛选"
      >
        <div className={`relative transition-[max-height] duration-300 z-10 ${!isExpanded ? 'max-h-[50px] overflow-hidden' : 'overflow-visible'
          }`}>
          <div
            ref={badgeContainerRef}
            className="flex items-center gap-2 flex-wrap p-1"
          >
            {badges.map((badge, index) => (
              <TypeBadgeItem
                key={badge.type}
                type={badge.type}
                count={badge.count}
                isSelected={selectedTypes.has(badge.type)}
                onToggle={() => onToggleType(badge.type)}
                isFocused={focusedIndex === index}
                onFocus={() => setFocusedIndex(index)}
                innerRef={(el) => { badgeRefs.current[index] = el; }}
              />
            ))}
          </div>
        </div>
        {hasOverflow && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="mt-2 text-xs text-[var(--text-color-secondary)] hover:text-[var(--accent-color)]
                     flex items-center gap-1 transition-colors self-start cursor-pointer"
          >
            <span>{isExpanded ? '收起' : '展开更多'}</span>
            <Icons.ChevronDown
              size={14}
              className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Mobile & Tablet: Horizontal Scroll */}
      <div
        className="flex md:hidden flex-1 -mx-1 px-1 overflow-hidden"
        role="group"
        aria-label="类型筛选"
      >
        <div
          ref={containerRef}
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        >
          {badges.map((badge, index) => (
            <TypeBadgeItem
              key={badge.type}
              type={badge.type}
              count={badge.count}
              isSelected={selectedTypes.has(badge.type)}
              onToggle={() => onToggleType(badge.type)}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              innerRef={(el) => { badgeRefs.current[index] = el; }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
