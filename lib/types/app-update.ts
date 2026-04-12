export interface AppReleaseEntry {
  version: string;
  publishedAt: string;
  title: string;
  notes: string[];
}

export interface AppReleaseManifest {
  repository: {
    owner: string;
    name: string;
    branch: string;
  };
  currentVersion: string;
  releases: AppReleaseEntry[];
}

export type AppUpdateStatus =
  | 'up-to-date'
  | 'update-available'
  | 'ahead-of-remote'
  | 'check-failed';

export interface AppUpdateSource {
  repository: string;
  branch: string;
  manifestUrl: string;
  changelogUrl: string;
  repositoryUrl: string;
}

export interface AppUpdateResponse {
  currentVersion: string;
  currentRelease: AppReleaseEntry | null;
  latestVersion: string;
  latestRelease: AppReleaseEntry | null;
  status: AppUpdateStatus;
  updateAvailable: boolean;
  checkedAt: string;
  checkedRemotely: boolean;
  usedRemoteManifest: boolean;
  source: AppUpdateSource;
  error?: string;
}

