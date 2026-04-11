/**
 * useSpatialNavigation
 * Provides D-pad/arrow key based 2D spatial navigation for TV mode.
 * Finds all [data-focusable] elements and navigates between them
 * based on directional arrow key presses.
 */

import { useEffect, useCallback } from 'react';

function getRect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

function getCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

type Direction = 'up' | 'down' | 'left' | 'right';

function findBestCandidate(
  current: Element,
  candidates: Element[],
  direction: Direction
): Element | null {
  const currentRect = getRect(current);
  const currentCenter = getCenter(currentRect);

  let bestElement: Element | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (candidate === current) continue;

    const candidateRect = getRect(candidate);
    const candidateCenter = getCenter(candidateRect);

    const dx = candidateCenter.x - currentCenter.x;
    const dy = candidateCenter.y - currentCenter.y;

    // Filter by direction
    let isInDirection = false;
    switch (direction) {
      case 'up':
        isInDirection = dy < -10;
        break;
      case 'down':
        isInDirection = dy > 10;
        break;
      case 'left':
        isInDirection = dx < -10;
        break;
      case 'right':
        isInDirection = dx > 10;
        break;
    }

    if (!isInDirection) continue;

    // Weighted distance: favor elements along the primary axis
    let score: number;
    if (direction === 'up' || direction === 'down') {
      score = Math.abs(dy) + Math.abs(dx) * 3;
    } else {
      score = Math.abs(dx) + Math.abs(dy) * 3;
    }

    if (score < bestScore) {
      bestScore = score;
      bestElement = candidate;
    }
  }

  return bestElement;
}

export function useSpatialNavigation(enabled: boolean) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const directionMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };

    const direction = directionMap[e.key];

    // For input/textarea: allow Left/Right for cursor movement,
    // but let Up/Down navigate spatially so the user can escape the input on TV.
    // Skip if the event was already handled (e.g., by search history dropdown).
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (isInput) {
      if (!direction || direction === 'left' || direction === 'right') {
        return;
      }
      // If a React handler already called preventDefault (e.g., dropdown navigation), skip
      if (e.defaultPrevented) {
        return;
      }
    }

    if (direction) {
      // Check if the focused element is inside a [data-no-spatial] container
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.closest('[data-no-spatial]')) return;

      const focusableElements = Array.from(
        document.querySelectorAll('[data-focusable]:not([disabled]):not([aria-hidden="true"])')
      ).filter(el => {
        // Filter out elements inside [data-no-spatial]
        if (el.closest('[data-no-spatial]')) return false;
        // Filter out hidden elements
        const rect = getRect(el);
        return rect.width > 0 && rect.height > 0;
      });

      if (focusableElements.length === 0) return;

      const currentFocused = document.activeElement;
      const isAlreadyFocused = currentFocused && focusableElements.includes(currentFocused);

      if (!isAlreadyFocused) {
        // Focus the first element
        (focusableElements[0] as HTMLElement).focus();
        e.preventDefault();
        return;
      }

      const best = findBestCandidate(currentFocused!, focusableElements, direction);
      if (best) {
        (best as HTMLElement).focus();
        best.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      // Trigger click on focused element
      const focused = document.activeElement as HTMLElement;
      if (focused && focused.hasAttribute('data-focusable')) {
        focused.click();
        e.preventDefault();
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
