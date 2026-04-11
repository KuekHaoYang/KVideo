/**
 * useTVDetection
 * Detects if the user is on a TV/set-top-box browser.
 */

import { useState, useEffect } from 'react';

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

export function useTVDetection(): boolean {
  const [isTV, setIsTV] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;

    // Check UA for TV indicators
    const uaMatch = TV_USER_AGENT_PATTERNS.some(pattern => pattern.test(ua));

    if (uaMatch) {
      setIsTV(true);
      return;
    }

    // Fallback heuristic: large screen + no touch + low pixel density
    const isLargeScreen = window.innerWidth >= 1280;
    const hasNoTouch = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
    const lowDensity = window.devicePixelRatio <= 1.5;

    if (isLargeScreen && hasNoTouch && lowDensity) {
      setIsTV(true);
    }
  }, []);

  return isTV;
}
