import 'server-only';

import type { RuntimeFeatures } from '@/lib/config/runtime-features';

function isVercelDeployment(): boolean {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

function isCloudflareDeployment(): boolean {
  return (
    process.env.CF_PAGES === '1' ||
    Boolean(process.env.CF_PAGES_URL) ||
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) ||
    Boolean(process.env.CF_ACCOUNT_ID) ||
    Boolean(process.env.WORKERS_CI)
  );
}

function getRestrictedFeatures(
  deploymentProvider: RuntimeFeatures['deploymentProvider'],
  deploymentProviderLabel: string
): RuntimeFeatures {
  return {
    deploymentProvider,
    deploymentProviderLabel,
    restrictedManagedDeployment: true,
    mediaProxyEnabled: false,
    iptvEnabled: false,
    restrictionSummary: `${deploymentProviderLabel} 托管部署会启用合规模式：关闭外部媒体代理、热链转发和 IPTV 流中继。需要这些能力时请改用 Docker 或传统 Node.js 自托管。`,
  };
}

export function getRuntimeFeatures(): RuntimeFeatures {
  if (isVercelDeployment()) {
    return getRestrictedFeatures('vercel', 'Vercel');
  }

  if (isCloudflareDeployment()) {
    return getRestrictedFeatures('cloudflare', 'Cloudflare');
  }

  return {
    deploymentProvider: 'self-hosted',
    deploymentProviderLabel: '自托管',
    restrictedManagedDeployment: false,
    mediaProxyEnabled: true,
    iptvEnabled: true,
    restrictionSummary: null,
  };
}

