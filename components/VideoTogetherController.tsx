'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { settingsStore } from '@/lib/store/settings-store';

const HIDE_STYLE_ID = 'kvideo-videotogether-visibility';
const SCRIPT_ID = 'kvideo-videotogether-script';

declare global {
  interface Window {
    VideoTogetherLoading?: boolean;
    VideoTogetherSettingEnabled?: boolean;
    videoTogetherWebsiteSettingUrl?: string;
    videoTogetherExtension?: unknown;
    videoTogetherFlyPannel?: {
      Minimize?: (isDefault?: boolean) => void;
    } | null;
  }
}

interface VideoTogetherControllerProps {
  envEnabled: boolean;
  scriptUrl: string;
  settingUrl?: string;
}

function isSupportedRoute(pathname: string | null): boolean {
  return pathname?.startsWith('/player') === true || pathname?.startsWith('/iptv') === true;
}

function syncMinimizedDefaults(forceCurrentPageMinimized: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('EnableMiniBar', JSON.stringify(true));
    localStorage.setItem('MinimiseDefault', JSON.stringify(true));

    if (forceCurrentPageMinimized) {
      localStorage.setItem('VideoTogetherMinimizedHere', '1');
      window.videoTogetherFlyPannel?.Minimize?.(true);
    }
  } catch {
    // Ignore storage failures so player pages continue working.
  }
}

function updateVisibility(hidden: boolean) {
  if (typeof document === 'undefined') {
    return;
  }

  let style = document.getElementById(HIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = HIDE_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = hidden
    ? `
      #VideoTogetherWrapper,
      #VideoTogetherfullscreenSWrapper,
      #videoTogetherLoading,
      #videoTogetherTxtMsgTouch {
        display: none !important;
      }
    `
    : `
      #videoTogetherLoading {
        display: none !important;
      }
    `;
}

export function VideoTogetherController({
  envEnabled,
  scriptUrl,
  settingUrl,
}: VideoTogetherControllerProps) {
  const pathname = usePathname();
  const [videoTogetherEnabled, setVideoTogetherEnabled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setVideoTogetherEnabled(settingsStore.getSettings().videoTogetherEnabled);
    };

    sync();
    return settingsStore.subscribe(sync);
  }, []);

  const supportedRoute = isSupportedRoute(pathname);
  const shouldActivate = envEnabled && videoTogetherEnabled && supportedRoute;

  useEffect(() => {
    if (!envEnabled || !videoTogetherEnabled) {
      updateVisibility(true);
      return;
    }

    syncMinimizedDefaults(supportedRoute);
  }, [envEnabled, videoTogetherEnabled, supportedRoute]);

  useEffect(() => {
    updateVisibility(!shouldActivate);
  }, [shouldActivate]);

  useEffect(() => {
    if (!shouldActivate) {
      return;
    }

    if (settingUrl) {
      window.videoTogetherWebsiteSettingUrl = settingUrl;
    }

    if (
      document.getElementById(SCRIPT_ID) ||
      document.getElementById('videotogether-script') ||
      window.VideoTogetherLoading ||
      window.videoTogetherExtension ||
      window.videoTogetherFlyPannel
    ) {
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = scriptUrl;
    script.async = true;

    document.body.appendChild(script);
  }, [scriptUrl, settingUrl, shouldActivate]);

  return null;
}
