import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStoredAccount,
  hashPassword,
  parseBootstrapAccounts,
  signSessionPayload,
  verifyPassword,
  verifySessionToken,
} from '@/lib/server/auth-helpers';
import {
  hasResolvedPermission,
  hasRoleAtLeast,
  resolvePermissions,
} from '@/lib/auth/permissions';

test('parseBootstrapAccounts supports legacy password:name entries', () => {
  const accounts = parseBootstrapAccounts('pass1:张三:admin,pass2:李四:viewer:iptv_access|danmaku_api');

  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].username, 'user-1');
  assert.equal(accounts[0].name, '张三');
  assert.equal(accounts[0].role, 'admin');
  assert.deepEqual(accounts[1].customPermissions, ['iptv_access', 'danmaku_api']);
});

test('parseBootstrapAccounts supports username:password:name entries and deduplicates usernames', () => {
  const accounts = parseBootstrapAccounts('alice:p1:Alice,bob:p2:Bob,alice:p3:Alice Clone');

  assert.equal(accounts.length, 3);
  assert.equal(accounts[0].username, 'alice');
  assert.equal(accounts[1].username, 'bob');
  assert.equal(accounts[2].username, 'alice-2');
});

test('hashPassword and verifyPassword round-trip correctly', async () => {
  const password = await hashPassword('secret-123');

  assert.ok(password.hash);
  assert.ok(password.salt);
  assert.equal(await verifyPassword('secret-123', password.salt, password.hash), true);
  assert.equal(await verifyPassword('wrong-password', password.salt, password.hash), false);
});

test('signSessionPayload and verifySessionToken reject tampering', async () => {
  const token = await signSessionPayload({
    accountId: 'account-1',
    profileId: 'profile-1',
    username: 'alice',
    name: 'Alice',
    role: 'super_admin',
    customPermissions: ['iptv_access'],
    mode: 'managed',
    iat: Date.now(),
  }, 'test-secret');

  const decoded = await verifySessionToken(token, 'test-secret');
  assert.ok(decoded);
  assert.equal(decoded?.username, 'alice');
  assert.equal(decoded?.mode, 'managed');

  const parts = token.split('.');
  const tampered = `${parts[0]}.${parts[1]}-tampered.${parts[2]}`;
  assert.equal(await verifySessionToken(tampered, 'test-secret'), null);
});

test('createStoredAccount stores hashed password and normalized permissions', async () => {
  const account = await createStoredAccount({
    username: 'alice',
    password: 'secret',
    name: 'Alice',
    role: 'viewer',
    customPermissions: ['iptv_access', 'iptv_builtin_sources'],
  });

  assert.equal(account.username, 'alice');
  assert.notEqual(account.passwordHash, 'secret');
  assert.equal(await verifyPassword('secret', account.passwordSalt, account.passwordHash), true);
});

test('resolvePermissions applies role defaults and IPTV management inheritance', () => {
  const viewerPermissions = resolvePermissions('viewer', ['iptv_access']);
  assert.ok(viewerPermissions.includes('iptv_access'));
  assert.ok(viewerPermissions.includes('iptv_source_management'));
  assert.equal(hasResolvedPermission('admin', 'player_settings'), true);
  assert.equal(hasResolvedPermission('viewer', 'account_management'), false);
  assert.equal(hasRoleAtLeast('super_admin', 'admin'), true);
});
