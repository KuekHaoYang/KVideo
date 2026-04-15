import { extractQualityLabel } from '@/lib/utils/video';

export interface ResolutionBadge {
  label: string;
  color: string;
}

export interface ResolutionLike extends ResolutionBadge {
  width?: number;
  height?: number;
  origin?: 'probed' | 'played';
  episodeIndex?: number;
}

export function shouldExpandForCurrentSource(
  sources: Array<{ source: string }>,
  currentSource: string,
  maxVisible = 5
): boolean {
  const currentIndex = sources.findIndex((source) => source.source === currentSource);
  return currentIndex >= maxVisible;
}

export function getSourceResolutionBadge(options: {
  isCurrent: boolean;
  currentResolution?: ResolutionLike | null;
  probedResolution?: ResolutionLike | null;
  cachedResolution?: ResolutionLike | null;
  remarks?: string;
}): ResolutionBadge | null {
  const { isCurrent, currentResolution, probedResolution, cachedResolution, remarks } = options;

  if (isCurrent && currentResolution) {
    return { label: currentResolution.label, color: currentResolution.color };
  }

  if (probedResolution) {
    return { label: probedResolution.label, color: probedResolution.color };
  }

  if (cachedResolution) {
    return { label: cachedResolution.label, color: cachedResolution.color };
  }

  return extractQualityLabel(remarks) || null;
}
