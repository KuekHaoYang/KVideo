/**
 * SourceBadgeList - Badge list container with responsive layout
 * Desktop: Expandable grid with show more/less
 * Mobile: Horizontal scroll with snap
 */

'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Icons } from '@/components/ui/Icon';
import { SourceBadgeItem } from './SourceBadgeItem';
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation';

const EXPAND_KEY = 'kvideo_source_badges_expanded';

interface Source {
  id: string;
  name: string;
  count: number;
  typeName?: string;
}

interface SourceBadgeListProps {
  sources: Source[];
  selectedSources: Set<string>;
  onToggleSource: (sourceId: string) => void;
}

export function SourceBadgeList({ sources, selectedSources, onToggleSource }: SourceBadgeListProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(EXPAND_KEY);
    return saved !== 'false'; // default to expanded
  });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hasOverflow, setHasOverflow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeContainerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Group sources by typeName if type info is available
  const typeGroups = useMemo(() => {
    const groups = new Map<string, Source[]>();
    for (const source of sources) {
      const type = source.typeName || '';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(source);
    }
    // Only use grouping if there are meaningful type names
    const hasTypes = groups.size > 1 || (groups.size === 1 && !groups.has(''));
    return hasTypes ? groups : null;
  }, [sources]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem(EXPAND_KEY, String(next));
      return next;
    });
  }, []);

  // Keyboard navigation
  useKeyboardNavigation({
    enabled: true,
    containerRef: containerRef,
    currentIndex: focusedIndex,
    itemCount: sources.length,
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
      onToggleSource(sources[index].id);
    }, [sources, onToggleSource]),
  });

  // Check if content has overflow on mount and when source count changes
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
  }, [sources.length]);

  return (
    <>
      {/* Desktop: Expandable Grid */}
      <div
        ref={containerRef}
        className="hidden md:flex md:flex-col md:flex-1 -mx-1 px-1"
        role="group"
        aria-label="视频源筛选"
      >
        <div className={`relative transition-[max-height] duration-300 z-10 ${!isExpanded ? 'max-h-[50px] overflow-hidden' : 'overflow-visible'
          }`}>
          <div
            ref={badgeContainerRef}
            className="flex items-center gap-2 flex-wrap p-1"
          >
            {typeGroups ? (
              Array.from(typeGroups.entries()).map(([typeName, typeSources]) => (
                <div key={typeName || '__default'} className="flex items-center gap-2 flex-wrap">
                  {typeName && (
                    <span className="text-[10px] font-medium text-[var(--text-color-secondary)] uppercase tracking-wider px-1 select-none">
                      {typeName}:
                    </span>
                  )}
                  {typeSources.map((source) => {
                    const globalIndex = sources.indexOf(source);
                    return (
                      <SourceBadgeItem
                        key={source.id}
                        id={source.id}
                        name={source.name}
                        count={source.count}
                        isSelected={selectedSources.has(source.id)}
                        onToggle={() => onToggleSource(source.id)}
                        isFocused={focusedIndex === globalIndex}
                        onFocus={() => setFocusedIndex(globalIndex)}
                        innerRef={(el: HTMLButtonElement | null) => { badgeRefs.current[globalIndex] = el; }}
                      />
                    );
                  })}
                </div>
              ))
            ) : (
              sources.map((source, index) => (
                <SourceBadgeItem
                  key={source.id}
                  id={source.id}
                  name={source.name}
                  count={source.count}
                  isSelected={selectedSources.has(source.id)}
                  onToggle={() => onToggleSource(source.id)}
                  isFocused={focusedIndex === index}
                  onFocus={() => setFocusedIndex(index)}
                  innerRef={(el: HTMLButtonElement | null) => { badgeRefs.current[index] = el; }}
                />
              ))
            )}
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
        aria-label="视频源筛选"
      >
        <div
          ref={containerRef}
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        >
          {sources.map((source, index) => (
            <SourceBadgeItem
              key={source.id}
              id={source.id}
              name={source.name}
              count={source.count}
              isSelected={selectedSources.has(source.id)}
              onToggle={() => onToggleSource(source.id)}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              innerRef={(el: HTMLButtonElement | null) => { badgeRefs.current[index] = el; }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
