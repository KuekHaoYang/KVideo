'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { profiledKey } from '@/lib/utils/profile-storage';

type FloatingAnchor = 'left' | 'right';

interface FloatingButtonPosition {
  x: number;
  y: number;
}

interface StoredFloatingPosition {
  xRatio: number;
  yRatio: number;
}

interface UseFloatingButtonPositionOptions {
  storageKey: string;
  defaultAnchor: FloatingAnchor;
  defaultYRatio?: number;
  buttonSize?: number;
  margin?: number;
}

interface DragState {
  active: boolean;
  dragging: boolean;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  offsetX: number;
  offsetY: number;
}

const DRAG_THRESHOLD = 8;

const INITIAL_DRAG_STATE: DragState = {
  active: false,
  dragging: false,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useFloatingButtonPosition({
  storageKey,
  defaultAnchor,
  defaultYRatio = 0.5,
  buttonSize = 56,
  margin = 16,
}: UseFloatingButtonPositionOptions) {
  const [position, setPosition] = useState<FloatingButtonPosition | null>(null);
  const dragStateRef = useRef<DragState>(INITIAL_DRAG_STATE);
  const positionRef = useRef<FloatingButtonPosition | null>(null);
  const suppressClickRef = useRef(false);
  const listenerAbortControllerRef = useRef<AbortController | null>(null);

  const clampPosition = useCallback((x: number, y: number, width: number, height: number) => ({
    x: clamp(x, margin, Math.max(margin, width - buttonSize - margin)),
    y: clamp(y, margin, Math.max(margin, height - buttonSize - margin)),
  }), [buttonSize, margin]);

  const getDefaultPosition = useCallback((width: number, height: number) => {
    const x = defaultAnchor === 'left'
      ? margin
      : Math.max(margin, width - buttonSize - margin);
    const centeredY = height * defaultYRatio - buttonSize / 2;

    return clampPosition(x, centeredY, width, height);
  }, [buttonSize, clampPosition, defaultAnchor, defaultYRatio, margin]);

  const persistPosition = useCallback((nextPosition: FloatingButtonPosition) => {
    if (typeof window === 'undefined') return;

    const payload: StoredFloatingPosition = {
      xRatio: nextPosition.x / window.innerWidth,
      yRatio: nextPosition.y / window.innerHeight,
    };

    localStorage.setItem(profiledKey(storageKey), JSON.stringify(payload));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadPosition = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const fallbackPosition = getDefaultPosition(width, height);

      try {
        const raw = localStorage.getItem(profiledKey(storageKey));
        if (!raw) {
          positionRef.current = fallbackPosition;
          setPosition(fallbackPosition);
          return;
        }

        const parsed = JSON.parse(raw) as Partial<StoredFloatingPosition>;
        if (typeof parsed.xRatio !== 'number' || typeof parsed.yRatio !== 'number') {
          positionRef.current = fallbackPosition;
          setPosition(fallbackPosition);
          return;
        }

        const nextPosition = clampPosition(
          parsed.xRatio * width,
          parsed.yRatio * height,
          width,
          height
        );

        positionRef.current = nextPosition;
        setPosition(nextPosition);
      } catch {
        positionRef.current = fallbackPosition;
        setPosition(fallbackPosition);
      }
    };

    loadPosition();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const fallbackPosition = getDefaultPosition(width, height);
      const basePosition = positionRef.current || fallbackPosition;
      const nextPosition = clampPosition(basePosition.x, basePosition.y, width, height);

      positionRef.current = nextPosition;
      setPosition(nextPosition);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, getDefaultPosition, storageKey]);

  const finishDrag = useCallback(() => {
    const dragState = dragStateRef.current;
    const didDrag = dragState.dragging;

    if (didDrag && positionRef.current) {
      persistPosition(positionRef.current);
    }

    suppressClickRef.current = didDrag;
    dragStateRef.current = INITIAL_DRAG_STATE;
  }, [persistPosition]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const movedX = Math.abs(event.clientX - dragState.startClientX);
    const movedY = Math.abs(event.clientY - dragState.startClientY);

    if (!dragState.dragging && (movedX > DRAG_THRESHOLD || movedY > DRAG_THRESHOLD)) {
      dragState.dragging = true;
    }

    if (!dragState.dragging) {
      return;
    }

    event.preventDefault();

    const nextPosition = clampPosition(
      event.clientX - dragState.offsetX,
      event.clientY - dragState.offsetY,
      window.innerWidth,
      window.innerHeight
    );

    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, [clampPosition]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    finishDrag();
    listenerAbortControllerRef.current?.abort();
    listenerAbortControllerRef.current = null;
  }, [finishDrag]);

  useEffect(() => {
    return () => {
      listenerAbortControllerRef.current?.abort();
      listenerAbortControllerRef.current = null;
    };
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    dragStateRef.current = {
      active: true,
      dragging: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    listenerAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    listenerAbortControllerRef.current = abortController;

    window.addEventListener('pointermove', handlePointerMove, {
      passive: false,
      signal: abortController.signal,
    });
    window.addEventListener('pointerup', handlePointerUp, { signal: abortController.signal });
    window.addEventListener('pointercancel', handlePointerUp, { signal: abortController.signal });
  }, [handlePointerMove, handlePointerUp]);

  const consumeSyntheticClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return false;

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  const floatingStyle = position
    ? {
      left: `${position.x}px`,
      top: `${position.y}px`,
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
    }
    : defaultAnchor === 'left'
      ? {
        left: `${margin}px`,
        top: '50%',
        right: 'auto',
        bottom: 'auto',
        transform: 'translateY(-50%)',
      }
      : {
        right: `${margin}px`,
        top: '50%',
        left: 'auto',
        bottom: 'auto',
        transform: 'translateY(-50%)',
      };

  return {
    floatingStyle,
    onPointerDown,
    consumeSyntheticClick,
  };
}
