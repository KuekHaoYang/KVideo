export type DeploymentProvider = 'self-hosted' | 'vercel' | 'cloudflare';

export interface RuntimeFeatures {
  deploymentProvider: DeploymentProvider;
  deploymentProviderLabel: string;
  restrictedManagedDeployment: boolean;
  mediaProxyEnabled: boolean;
  iptvEnabled: boolean;
  restrictionSummary: string | null;
}

