import { useState, useEffect } from 'react';

/**
 * Maps video resolution height to a human-readable quality label.
 */
function getResolutionLabel(width: number, height: number): { label: string; color: string } | null {
  if (width === 0 || height === 0) return null;

  // Use the larger dimension in case of portrait video
  const h = Math.max(width, height) === width ? height : width;

  if (h >= 2160) return { label: '4K', color: 'bg-amber-500' };
  if (h >= 1440) return { label: '2K', color: 'bg-emerald-500' };
  if (h >= 1080) return { label: '1080P', color: 'bg-green-500' };
  if (h >= 720) return { label: '720P', color: 'bg-teal-500' };
  if (h >= 480) return { label: '480P', color: 'bg-sky-500' };
  if (h >= 360) return { label: '360P', color: 'bg-gray-500' };
  return { label: `${h}P`, color: 'bg-gray-500' };
}

export interface VideoResolutionInfo {
  width: number;
  height: number;
  label: string;
  color: string;
}

/**
 * Detects the actual video resolution from the <video> element
 * after metadata is loaded.
 */
export function useVideoResolution(videoRef: React.RefObject<HTMLVideoElement | null>): VideoResolutionInfo | null {
  const [resolution, setResolution] = useState<VideoResolutionInfo | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const detectResolution = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        const info = getResolutionLabel(w, h);
        if (info) {
          setResolution({ width: w, height: h, ...info });
        }
      }
    };

    // Detect on loadedmetadata and also on resize (quality change)
    video.addEventListener('loadedmetadata', detectResolution);
    video.addEventListener('resize', detectResolution);

    // Check if already loaded
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      detectResolution();
    }

    return () => {
      video.removeEventListener('loadedmetadata', detectResolution);
      video.removeEventListener('resize', detectResolution);
    };
  }, [videoRef]);

  return resolution;
}
