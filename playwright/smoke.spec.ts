import { test, expect, type Page } from '@playwright/test';

async function stubAmbientApiCalls(page: Page) {
  await page.route('**/api/app-update', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentVersion: 'test',
        latestVersion: 'test',
        status: 'up-to-date',
        updateAvailable: false,
        checkedAt: new Date().toISOString(),
        checkedRemotely: false,
        usedRemoteManifest: false,
        currentRelease: null,
        latestRelease: null,
        source: {
          repository: 'KuekHaoYang/KVideo',
          branch: 'main',
          manifestUrl: 'https://example.com/app-release.json',
          changelogUrl: 'https://example.com/changelog',
          repositoryUrl: 'https://example.com/repo',
        },
      }),
    });
  });

  await page.route('**/api/douban/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function login(page: Page) {
  await stubAmbientApiCalls(page);
  await page.goto('/');
  await expect(page.getByText('访问受限')).toBeVisible();
  await page.getByPlaceholder('输入密码...').fill('playwright-pass');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page.getByRole('textbox', { name: /搜索/i }).or(page.getByPlaceholder(/搜索/i)).first()).toBeVisible();
}

test('legacy password login and logout flow works', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await expect(page.getByText('账户管理')).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).first().click();
  await expect(page.getByText('访问受限')).toBeVisible();
});

test('settings danger zone and IPTV empty state render after login', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await expect(page.getByText('危险操作')).toBeVisible();
  await page.getByRole('button', { name: '清除所有数据' }).click();
  await expect(page.getByText('这将删除本地设置、历史记录、缓存，并退出当前登录会话。')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();

  await page.goto('/iptv');
  await expect(page.getByText(/IPTV 直播频道|0 个频道/)).toBeVisible();
});

test('settings reset clears the current session and returns to the login gate', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: '清除所有数据' }).click();
  await page.getByRole('button', { name: '清除', exact: true }).click();
  await expect(page.getByText('访问受限')).toBeVisible();
});

test('proxy rejects private targets even when relay is enabled', async ({ page }) => {
  await login(page);
  const response = await page.request.get('/api/proxy?url=http://127.0.0.1/private.m3u8');
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    error: 'Proxy request failed',
  });
});

test('home still renders in reduced motion mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await expect(page.getByRole('textbox', { name: /搜索/i }).or(page.getByPlaceholder(/搜索/i)).first()).toBeVisible();
});
