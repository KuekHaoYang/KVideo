import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = 3301;
const baseUrl = `http://localhost:${port}`;

function findLocalChromiumExecutable() {
  if (process.env.CI) {
    return undefined;
  }

  const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) {
    return undefined;
  }

  const installedChromiumDirs = fs.readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()
    .reverse();

  for (const chromiumDir of installedChromiumDirs) {
    const executablePath = path.join(
      cacheRoot,
      chromiumDir,
      'chrome-mac',
      'Chromium.app',
      'Contents',
      'MacOS',
      'Chromium',
    );

    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  }

  return undefined;
}

const localChromiumExecutable = findLocalChromiumExecutable();

export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    launchOptions: localChromiumExecutable
      ? {
          executablePath: localChromiumExecutable,
        }
      : undefined,
  },
  webServer: {
    command: `PORT=${port} ACCESS_PASSWORD=playwright-pass AUTH_SECRET=playwright-secret KVIDEO_PUBLIC_RELAY_ENABLED=true npm run dev`,
    url: baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
