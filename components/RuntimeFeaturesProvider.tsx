'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { RuntimeFeatures } from '@/lib/config/runtime-features';

const defaultRuntimeFeatures: RuntimeFeatures = {
  deploymentProvider: 'self-hosted',
  deploymentProviderLabel: '自托管',
  restrictedManagedDeployment: false,
  mediaProxyEnabled: true,
  iptvEnabled: true,
  restrictionSummary: null,
};

const RuntimeFeaturesContext = createContext<RuntimeFeatures>(defaultRuntimeFeatures);

interface RuntimeFeaturesProviderProps {
  initialFeatures: RuntimeFeatures;
  children: ReactNode;
}

export function RuntimeFeaturesProvider({ initialFeatures, children }: RuntimeFeaturesProviderProps) {
  return (
    <RuntimeFeaturesContext.Provider value={initialFeatures}>
      {children}
    </RuntimeFeaturesContext.Provider>
  );
}

export function useRuntimeFeatures(): RuntimeFeatures {
  return useContext(RuntimeFeaturesContext);
}
