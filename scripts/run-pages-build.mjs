import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const routeFiles = [
  'app/api/app-update/route.ts',
  'app/api/auth/route.ts',
  'app/api/auth/accounts/route.ts',
  'app/api/auth/accounts/[accountId]/route.ts',
  'app/api/auth/session/route.ts',
  'app/api/config/route.ts',
  'app/api/danmaku/route.ts',
  'app/api/detail/route.ts',
  'app/api/douban/image/route.ts',
  'app/api/douban/recommend/route.ts',
  'app/api/douban/tags/route.ts',
  'app/api/iptv/route.ts',
  'app/api/iptv/stream/route.ts',
  'app/api/ping/route.ts',
  'app/api/premium/category/route.ts',
  'app/api/premium/types/route.ts',
  'app/api/probe-resolution/route.ts',
  'app/api/proxy/route.ts',
  'app/api/search-parallel/route.ts',
  'app/api/user/config/route.ts',
  'app/api/user/sync/route.ts',
];

const runtimeLine = "export const runtime = 'nodejs';";
const edgeRuntimeLine = "export const runtime = 'edge';";

async function rewriteRoutes(rootDir) {
  const originals = new Map();

  try {
    for (const relativePath of routeFiles) {
      const filePath = path.join(rootDir, relativePath);
      const original = await fs.readFile(filePath, 'utf8');

      if (!original.includes(runtimeLine)) {
        throw new Error(`Expected ${relativePath} to contain ${runtimeLine}`);
      }

      originals.set(filePath, original);
      await fs.writeFile(filePath, original.replace(runtimeLine, edgeRuntimeLine));
    }
  } catch (error) {
    await restoreRoutes(originals);
    throw error;
  }

  return originals;
}

async function restoreRoutes(originals) {
  await Promise.all(
    [...originals.entries()].map(([filePath, contents]) => fs.writeFile(filePath, contents)),
  );
}

async function runNextOnPages(rootDir) {
  await new Promise((resolve, reject) => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['next-on-pages'], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`next-on-pages exited with signal ${signal}`));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`next-on-pages exited with code ${code}`));
    });
  });
}

const rootDir = process.cwd();
const originals = await rewriteRoutes(rootDir);

try {
  await runNextOnPages(rootDir);
} finally {
  await restoreRoutes(originals);
}
