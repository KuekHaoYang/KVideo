'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
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

function normalizeHttpsUrl(rawUrl?: string): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === 'https:' ? parsedUrl.toString() : null;
  } catch {
    return null;
  }
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
  const videoTogetherEnabled = useSyncExternalStore(
    (listener) => settingsStore.subscribe(listener),
    () => settingsStore.getSettings().videoTogetherEnabled,
    () => false,
  );
  const normalizedScriptUrl = useMemo(() => normalizeHttpsUrl(scriptUrl), [scriptUrl]);
  const normalizedSettingUrl = useMemo(() => normalizeHttpsUrl(settingUrl), [settingUrl]);

  const supportedRoute = isSupportedRoute(pathname);
  const shouldActivate =
    envEnabled &&
    Boolean(normalizedScriptUrl) &&
    videoTogetherEnabled &&
    supportedRoute;

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

    if (normalizedSettingUrl) {
      window.videoTogetherWebsiteSettingUrl = normalizedSettingUrl;
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
    script.src = normalizedScriptUrl!;
    script.async = true;

    document.body.appendChild(script);
  }, [normalizedScriptUrl, normalizedSettingUrl, shouldActivate]);

  return null;
}
