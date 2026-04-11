'use client';

import { DesktopVideoPlayer } from './DesktopVideoPlayer';


interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  // Episode navigation props for auto-skip/auto-next
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  // Danmaku props
  videoTitle?: string;
  episodeName?: string;
  isPremium?: boolean;
  // Resolution callback
  onResolutionDetected?: (info: import('./hooks/useVideoResolution').VideoResolutionInfo) => void;
}

/**
 * Smart Video Player that renders different versions based on device
 * - Mobile/Tablet: Optimized touch controls, double-tap gestures, orientation lock
 * - Desktop: Full-featured player with hover interactions
 */
export function CustomVideoPlayer(props: CustomVideoPlayerProps) {
  return <DesktopVideoPlayer {...props} />;
}
