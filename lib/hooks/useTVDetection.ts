/**
 * useTVDetection
 * Detects if the user is on a TV/set-top-box browser.
 */

import { useSyncExternalStore } from 'react';

const TV_USER_AGENT_PATTERNS = [
  /smarttv/i,
  /tizen/i,
  /webos/i,
  /firetv/i,
  /android tv/i,
  /googletv/i,
  /crkey/i, // Chromecast
  /aftt/i, // Amazon Fire TV Stick
  /aftm/i, // Amazon Fire TV
  /bravia/i, // Sony Bravia
  /netcast/i, // LG NetCast
  /viera/i, // Panasonic Viera
  /hbbtv/i,
];

function computeIsTV(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  const uaMatch = TV_USER_AGENT_PATTERNS.some((pattern) => pattern.test(ua));
  if (uaMatch) {
    return true;
  }

  const maxDimension = Math.max(window.screen.width, window.screen.height);
  const minDimension = Math.min(window.screen.width, window.screen.height);
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover =
    window.matchMedia('(hover: none)').matches &&
    window.matchMedia('(any-hover: none)').matches;
  const noTouch = navigator.maxTouchPoints === 0;
  const largeScreen = maxDimension >= 1280 && minDimension >= 720;

  return largeScreen && coarsePointer && noHover && noTouch;
}

function subscribeToTVSignals(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQueries = [
    window.matchMedia('(pointer: coarse)'),
    window.matchMedia('(hover: none)'),
    window.matchMedia('(any-hover: none)'),
  ];

  window.addEventListener('resize', listener);
  mediaQueries.forEach((mediaQuery) => mediaQuery.addEventListener('change', listener));

  return () => {
    window.removeEventListener('resize', listener);
    mediaQueries.forEach((mediaQuery) => mediaQuery.removeEventListener('change', listener));
  };
}

export function useTVDetection(): boolean {
  return useSyncExternalStore(subscribeToTVSignals, computeIsTV, () => false);
}
