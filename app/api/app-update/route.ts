import {
  APP_VERSION,
  compareVersions,
  getDefaultRepositoryBranch,
  getDefaultRepositorySlug,
  getReleaseByVersion,
  LOCAL_RELEASE_MANIFEST,
} from '@/lib/app-release';
import type {
  AppReleaseEntry,
  AppReleaseManifest,
  AppUpdateResponse,
} from '@/lib/types/app-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANIFEST_PATH = 'app-release.json';
const CHANGELOG_PATH = 'CHANGELOG.md';

function parseRepositoryTarget(repository: string) {
  const [owner, name] = repository.split('/', 2);

  if (!owner || !name) {
    return null;
  }

  return { owner, name };
}

function buildSourceInfo(repository: string, branch: string) {
  const target = parseRepositoryTarget(repository);

  if (!target) {
    const emptyUrl = 'https://github.com';
    return {
      repository,
      branch,
      manifestUrl: emptyUrl,
      changelogUrl: emptyUrl,
      repositoryUrl: emptyUrl,
    };
  }

  const { owner, name } = target;

  return {
    repository,
    branch,
    manifestUrl: `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${MANIFEST_PATH}`,
    changelogUrl: `https://github.com/${owner}/${name}/blob/${branch}/${CHANGELOG_PATH}`,
    repositoryUrl: `https://github.com/${owner}/${name}`,
  };
}

function isValidReleaseEntry(value: unknown): value is AppReleaseEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<AppReleaseEntry>;

  return (
    typeof entry.version === 'string' &&
    typeof entry.publishedAt === 'string' &&
    typeof entry.title === 'string' &&
    Array.isArray(entry.notes) &&
    entry.notes.every((note) => typeof note === 'string')
  );
}

function normalizeManifest(
  value: unknown,
  repository: string,
  branch: string,
): AppReleaseManifest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const manifest = value as Partial<AppReleaseManifest>;
  const target = parseRepositoryTarget(repository);

  if (!target || typeof manifest.currentVersion !== 'string' || !Array.isArray(manifest.releases)) {
    return null;
  }

  const releases = manifest.releases.filter(isValidReleaseEntry);

  if (releases.length === 0) {
    return null;
  }

  return {
    repository: {
      owner: manifest.repository?.owner || target.owner,
      name: manifest.repository?.name || target.name,
      branch: manifest.repository?.branch || branch,
    },
    currentVersion: manifest.currentVersion,
    releases,
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<T>;
}

function buildResponse(
  repository: string,
  branch: string,
  overrides: Partial<AppUpdateResponse> = {},
): AppUpdateResponse {
  const source = buildSourceInfo(repository, branch);
  const currentRelease = getReleaseByVersion(APP_VERSION);

  return {
    currentVersion: APP_VERSION,
    currentRelease,
    latestVersion: APP_VERSION,
    latestRelease: currentRelease,
    status: 'up-to-date',
    updateAvailable: false,
    checkedAt: new Date().toISOString(),
    checkedRemotely: false,
    usedRemoteManifest: false,
    source,
    ...overrides,
  };
}

export async function GET() {
  const repository =
    process.env.UPDATE_REPOSITORY?.trim() ||
    process.env.NEXT_PUBLIC_UPDATE_REPOSITORY?.trim() ||
    getDefaultRepositorySlug();
  const branch =
    process.env.UPDATE_BRANCH?.trim() ||
    process.env.NEXT_PUBLIC_UPDATE_BRANCH?.trim() ||
    getDefaultRepositoryBranch();

  const source = buildSourceInfo(repository, branch);

  try {
    const remoteManifestJson = await fetchJson<unknown>(source.manifestUrl);
    const remoteManifest = normalizeManifest(remoteManifestJson, repository, branch);

    if (remoteManifest) {
      const latestVersion = remoteManifest.currentVersion;
      const latestRelease =
        getReleaseByVersion(latestVersion, remoteManifest) ?? remoteManifest.releases[0] ?? null;
      const comparison = compareVersions(latestVersion, APP_VERSION);

      return Response.json(
        buildResponse(repository, branch, {
          latestVersion,
          latestRelease,
          status:
            comparison > 0
              ? 'update-available'
              : comparison < 0
                ? 'ahead-of-remote'
                : 'up-to-date',
          updateAvailable: comparison > 0,
          checkedRemotely: true,
          usedRemoteManifest: true,
        }),
      );
    }

    const remotePackage = await fetchJson<{ version?: string }>(`${source.manifestUrl.replace(MANIFEST_PATH, 'package.json')}`);
    const latestVersion = remotePackage?.version?.trim();

    if (latestVersion) {
      const comparison = compareVersions(latestVersion, APP_VERSION);

      return Response.json(
        buildResponse(repository, branch, {
          latestVersion,
          latestRelease: getReleaseByVersion(latestVersion, LOCAL_RELEASE_MANIFEST),
          status:
            comparison > 0
              ? 'update-available'
              : comparison < 0
                ? 'ahead-of-remote'
                : 'up-to-date',
          updateAvailable: comparison > 0,
          checkedRemotely: true,
          usedRemoteManifest: false,
        }),
      );
    }

    return Response.json(
      buildResponse(repository, branch, {
        status: 'check-failed',
        error: '无法获取远程版本信息。',
      }),
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      buildResponse(repository, branch, {
        status: 'check-failed',
        error: error instanceof Error ? error.message : '未知错误',
      }),
      { status: 200 },
    );
  }
}
