/**
 * SourceBadgeItem - Individual source badge component
 * Displays a single video source badge with count, supports selection state
 */

interface SourceBadgeItemProps {
  id: string;
  name: string;
  count: number;
  isSelected: boolean;
  onToggle: () => void;
  isFocused?: boolean;
  onFocus?: () => void;
  innerRef?: (el: HTMLButtonElement | null) => void;
}

export function SourceBadgeItem({
  id,
  name,
  count,
  isSelected,
  onToggle,
  isFocused = false,
  onFocus,
  innerRef,
}: SourceBadgeItemProps) {
  const handleClick = () => {
    // Immediate visual feedback before state update
    onToggle();
  };

  return (
    <button
      type="button"
      ref={innerRef}
      onClick={handleClick}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      data-focusable
      aria-pressed={isSelected}
      aria-label={`${name} 视频源，${count} 个视频${isSelected ? '，已选中' : ''}`}
      className={`
        inline-flex items-center gap-1.5 px-4 py-2
        rounded-full
        border-2
        text-sm font-medium whitespace-nowrap
        transition-all duration-200 ease-out
        hover:scale-105 hover:shadow-[var(--shadow-sm)]
        active:scale-95 snap-start
        focus:outline-none cursor-pointer
        ${isSelected
          ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] shadow-md'
          : 'bg-[var(--glass-bg)] text-[var(--text-color)] border-[var(--glass-border)] hover:border-[var(--accent-color)]'
        }
      `}
    >
      <span>{name}</span>
      <span className={`
        px-2 py-0.5 rounded-full text-xs font-semibold
        ${isSelected
          ? 'bg-white/20 text-white'
          : 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
        }
      `}>
        {count}
      </span>
    </button>
  );
}
