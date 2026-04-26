'use client';

import { useEffect } from 'react';
import { useHistoryStore } from '@/lib/store/history-store';
import { useFavoritesStore } from '@/lib/store/favorites-store';
import { useCloudSync } from '@/lib/hooks/useCloudSync';
import { useConfigSync } from '@/lib/hooks/useConfigSync';
import { getSession } from '@/lib/store/auth-store';

type VoidCallback = () => void;

function debounce(fn: VoidCallback, delay: number): VoidCallback {
  let timeoutId: NodeJS.Timeout | null = null;

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => fn(), delay);
  };
}

export function AutoSync() {
  const { pushToCloud, pullFromCloud } = useCloudSync();

  // Config sync (sources, settings) — works without Redis, file-based
  useConfigSync();

  useEffect(() => {
    const session = getSession();
    if (!session) return; // 未登录不进行同步

    // 1. 刚打开网页时，主动从云端拉取一次最新数据
    pullFromCloud();

    // 2. 监听本地数据的变化，如果数据变了，延迟 5 秒后推送到云端
    const debouncedPush = debounce(pushToCloud, 5000);

    // 修改点在这里：Zustand v4/v5 默认 subscribe 只接受一个参数
    const unsubHistory = useHistoryStore.subscribe(() => {
      debouncedPush();
    });

    const unsubFavorites = useFavoritesStore.subscribe(() => {
      debouncedPush();
    });

    return () => {
      unsubHistory();
      unsubFavorites();
    };
  }, [pushToCloud, pullFromCloud]);

  return null; // 这是一个静默组件，不需要渲染任何UI
}
