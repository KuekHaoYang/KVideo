import appReleaseJson from '@/app-release.json';
import packageJson from '@/package.json';
import type { AppReleaseEntry, AppReleaseManifest } from '@/lib/types/app-update';

const rawManifest = appReleaseJson as AppReleaseManifest;

export const APP_VERSION = packageJson.version;

export const LOCAL_RELEASE_MANIFEST: AppReleaseManifest = {
  ...rawManifest,
  currentVersion: APP_VERSION,
};

function normalizeVersionParts(version: string): Array<number | string> {
  return version
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => {
      const parsed = Number.parseInt(part, 10);
      return Number.isNaN(parsed) ? part : parsed;
    });
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersionParts(left);
  const rightParts = normalizeVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (typeof leftPart === 'number' && typeof rightPart === 'number') {
      if (leftPart !== rightPart) {
        return leftPart > rightPart ? 1 : -1;
      }
      continue;
    }

    const comparison = String(leftPart).localeCompare(String(rightPart), undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    if (comparison !== 0) {
      return comparison > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function getReleaseByVersion(
  version: string,
  manifest: AppReleaseManifest = LOCAL_RELEASE_MANIFEST,
): AppReleaseEntry | null {
  return manifest.releases.find((release) => release.version === version) ?? null;
}

export function getLatestKnownRelease(
  manifest: AppReleaseManifest = LOCAL_RELEASE_MANIFEST,
): AppReleaseEntry | null {
  return manifest.releases[0] ?? null;
}

export function getDefaultRepositorySlug(
  manifest: AppReleaseManifest = LOCAL_RELEASE_MANIFEST,
): string {
  return `${manifest.repository.owner}/${manifest.repository.name}`;
}

export function getDefaultRepositoryBranch(
  manifest: AppReleaseManifest = LOCAL_RELEASE_MANIFEST,
): string {
  return manifest.repository.branch || 'main';
}
