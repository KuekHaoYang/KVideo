'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { DanmakuComment } from '@/lib/types/danmaku';
import { settingsStore } from '@/lib/store/settings-store';

interface DanmakuCanvasProps {
  comments: DanmakuComment[];
  currentTime: number;
  isPlaying: boolean;
  duration: number;
}

interface ActiveDanmaku {
  comment: DanmakuComment;
  x: number;
  y: number;
  speed: number;
  width: number;
  lane: number;
}

const SCROLL_DURATION = 8; // seconds for a comment to cross the screen
const LANE_HEIGHT_FACTOR = 1.4; // multiplied by font size for lane height
const TOP_BOTTOM_DURATION = 4; // seconds for top/bottom comments to stay visible
const MAX_LANES = 20;

export function DanmakuCanvas({ comments, currentTime, isPlaying, duration }: DanmakuCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveDanmaku[]>([]);
  const lastTimeRef = useRef(currentTime);
  const lastRafTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef(-1);
  const laneSlotsRef = useRef<number[]>(new Array(MAX_LANES).fill(0)); // tracks when each lane becomes free

  // Settings (read reactively)
  const [opacity, setOpacity] = React.useState(0.7);
  const [fontSize, setFontSize] = React.useState(20);
  const [displayArea, setDisplayArea] = React.useState(0.5);

  useEffect(() => {
    const s = settingsStore.getSettings();
    setOpacity(s.danmakuOpacity);
    setFontSize(s.danmakuFontSize);
    setDisplayArea(s.danmakuDisplayArea);
    const unsub = settingsStore.subscribe(() => {
      const ns = settingsStore.getSettings();
      setOpacity(ns.danmakuOpacity);
      setFontSize(ns.danmakuFontSize);
      setDisplayArea(ns.danmakuDisplayArea);
    });
    return unsub;
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Clear on seek (when currentTime jumps significantly)
  useEffect(() => {
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);
    if (timeDiff > 2) {
      activeRef.current = [];
      // Set to currentTime so only comments from the new position forward are spawned
      lastSpawnTimeRef.current = currentTime;
      laneSlotsRef.current = new Array(MAX_LANES).fill(0);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Spawn new comments based on currentTime
  const spawnComments = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !comments.length) return;

    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const effectiveHeight = rect.height * displayArea;
    const laneHeight = fontSize * LANE_HEIGHT_FACTOR;

    // Find comments in the time window [lastSpawn, time]
    const windowStart = lastSpawnTimeRef.current;
    const windowEnd = time;

    if (windowEnd <= windowStart) return;

    // Binary search for start index
    let lo = 0, hi = comments.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (comments[mid].time < windowStart) lo = mid + 1;
      else hi = mid;
    }

    // Spawn comments in range
    for (let i = lo; i < comments.length && comments[i].time <= windowEnd; i++) {
      const c = comments[i];
      const type = c.type || 'scroll';

      // Measure text width
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textWidth = ctx.measureText(c.text).width;

      if (type === 'scroll') {
        // Find available lane
        const speed = (canvasWidth + textWidth) / SCROLL_DURATION;
        let bestLane = -1;
        for (let lane = 0; lane < MAX_LANES; lane++) {
          const yPos = lane * laneHeight + fontSize;
          if (yPos > effectiveHeight - fontSize) break;
          if (laneSlotsRef.current[lane] <= time) {
            bestLane = lane;
            break;
          }
        }
        if (bestLane === -1) continue; // All lanes busy, drop comment

        // Calculate when this lane will be free again
        // (when the trailing edge of this comment has moved enough for a new one)
        const timeToPassStartPoint = textWidth / speed + 0.5; // add gap
        laneSlotsRef.current[bestLane] = time + timeToPassStartPoint;

        activeRef.current.push({
          comment: c,
          x: canvasWidth,
          y: bestLane * laneHeight + fontSize,
          speed,
          width: textWidth,
          lane: bestLane,
        });
      } else {
        // Top or bottom: find center lane
        const maxLanes = Math.floor(effectiveHeight / laneHeight / 2); // only use top/bottom half
        let bestLane = -1;
        for (let lane = 0; lane < Math.min(maxLanes, MAX_LANES); lane++) {
          const laneKey = type === 'top' ? lane : MAX_LANES - 1 - lane;
          if (laneSlotsRef.current[laneKey] <= time) {
            bestLane = lane;
            laneSlotsRef.current[laneKey] = time + TOP_BOTTOM_DURATION;
            break;
          }
        }
        if (bestLane === -1) continue;

        const y = type === 'top'
          ? bestLane * laneHeight + fontSize
          : effectiveHeight - bestLane * laneHeight - fontSize * 0.4;

        activeRef.current.push({
          comment: { ...c, _expiry: time + TOP_BOTTOM_DURATION } as any,
          x: (canvasWidth - textWidth) / 2,
          y,
          speed: 0,
          width: textWidth,
          lane: bestLane,
        });
      }
    }

    lastSpawnTimeRef.current = windowEnd;
  }, [comments, fontSize, displayArea]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const animate = (rafTime: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isPlaying) {
        // When paused, still draw active comments frozen in place
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.globalAlpha = opacity;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';

        for (const d of activeRef.current) {
          ctx.fillStyle = d.comment.color || '#ffffff';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(d.comment.text, d.x, d.y);
          ctx.fillText(d.comment.text, d.x, d.y);
        }

        ctx.restore();
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate time delta for animation
      const deltaMs = lastRafTimeRef.current ? rafTime - lastRafTimeRef.current : 16;
      lastRafTimeRef.current = rafTime;
      const deltaSec = deltaMs / 1000;

      // Spawn new comments
      spawnComments(currentTime);

      // Update & filter active comments
      const newActive: ActiveDanmaku[] = [];
      for (const d of activeRef.current) {
        const type = d.comment.type || 'scroll';

        if (type === 'scroll') {
          d.x -= d.speed * deltaSec;
          if (d.x + d.width > 0) {
            newActive.push(d);
          }
        } else {
          // Top/bottom: remove when expired
          const expiry = (d.comment as any)._expiry || 0;
          if (currentTime < expiry) {
            newActive.push(d);
          }
        }
      }
      activeRef.current = newActive;

      // Draw
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.globalAlpha = opacity;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';

      for (const d of activeRef.current) {
        ctx.fillStyle = d.comment.color || '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(d.comment.text, d.x, d.y);
        ctx.fillText(d.comment.text, d.x, d.y);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRafTimeRef.current = 0;
    };
  }, [isPlaying, currentTime, opacity, fontSize, spawnComments]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5] pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
