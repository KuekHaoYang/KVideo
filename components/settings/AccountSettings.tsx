'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, LogOut, Shield } from 'lucide-react';
import { clearSession, getSession, type Permission, type Role } from '@/lib/store/auth-store';
import { SettingsSection } from './SettingsSection';
import { Icons } from '@/components/ui/Icon';
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/auth/permissions';

type LoginMode = 'none' | 'legacy_password' | 'managed';

interface AccountInfo {
  id: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  createdAt: number;
  updatedAt: number;
}

interface EditableAccount {
  id?: string;
  username: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
  password: string;
  isNew?: boolean;
  markedForDeletion?: boolean;
}

interface LegacyConfigEntry {
  password: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
}

const PERMISSION_LABELS: Record<Permission, string> = {
  source_management: '视频源管理',
  account_management: '账户管理',
  danmaku_api: '弹幕 API',
  data_management: '数据管理',
  player_settings: '播放器设置',
  danmaku_appearance: '弹幕外观',
  view_settings: '显示设置',
  iptv_access: 'IPTV 访问',
  iptv_source_management: 'IPTV 自定义源管理',
  iptv_builtin_sources: 'IPTV 内置源',
};

function buildEditableAccounts(accounts: AccountInfo[]): EditableAccount[] {
  return accounts.map((account) => ({
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    customPermissions: account.customPermissions,
    password: '',
  }));
}

function arraysEqual(left: Permission[], right: Permission[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

async function logoutAndReload() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Best-effort logout: clear the local mirror even if the request fails.
  }

  clearSession();
  window.location.reload();
}

export function AccountSettings() {
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [hasAuth, setHasAuth] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>('none');
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [draftAccounts, setDraftAccounts] = useState<EditableAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLegacyConfig, setShowLegacyConfig] = useState(false);
  const [legacyEntries, setLegacyEntries] = useState<LegacyConfigEntry[]>([]);

  const canManageAccounts = session?.role === 'super_admin';
  const isManagedMode = loginMode === 'managed';

  const fetchAccounts = useCallback(async () => {
    if (!canManageAccounts) return;

    setLoadingAccounts(true);
    setSaveError('');

    try {
      const response = await fetch('/api/auth/accounts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load accounts');
      }

      const nextAccounts = (data.accounts || []) as AccountInfo[];
      setAccounts(nextAccounts);
      setDraftAccounts(buildEditableAccounts(nextAccounts));
      setIsDirty(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [canManageAccounts]);

  useEffect(() => {
    setSessionState(getSession());

    fetch('/api/auth')
      .then((response) => response.json())
      .then((data) => {
        setHasAuth(!!data.hasAuth);
        setLoginMode(data.loginMode || 'none');
      })
      .catch(() => {
        // Ignore config failures and keep the conservative default.
      });
  }, []);

  useEffect(() => {
    if (!canManageAccounts) return;
    fetchAccounts();
  }, [canManageAccounts, fetchAccounts, loginMode]);

  const currentDraftAccounts = useMemo(
    () => draftAccounts.filter((account) => !account.markedForDeletion),
    [draftAccounts]
  );

  const addDraftAccount = () => {
    setDraftAccounts((current) => [
      ...current,
      {
        username: '',
        name: '',
        role: 'viewer',
        customPermissions: [],
        password: '',
        isNew: true,
      },
    ]);
    setIsDirty(true);
    setSaveSuccess('');
  };

  const updateDraftAccount = (index: number, patch: Partial<EditableAccount>) => {
    setDraftAccounts((current) => current.map((account, accountIndex) => {
      if (accountIndex !== index) return account;
      return {
        ...account,
        ...patch,
      };
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const toggleDraftPermission = (index: number, permission: Permission) => {
    setDraftAccounts((current) => current.map((account, accountIndex) => {
      if (accountIndex !== index) return account;

      const nextPermissions = account.customPermissions.includes(permission)
        ? account.customPermissions.filter((value) => value !== permission)
        : [...account.customPermissions, permission];

      return {
        ...account,
        customPermissions: nextPermissions,
      };
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const removeDraftAccount = (index: number) => {
    setDraftAccounts((current) => current.flatMap((account, accountIndex) => {
      if (accountIndex !== index) return [account];
      if (account.isNew) return [];
      return [{ ...account, markedForDeletion: true }];
    }));
    setIsDirty(true);
    setSaveSuccess('');
  };

  const restoreDrafts = () => {
    setDraftAccounts(buildEditableAccounts(accounts));
    setIsDirty(false);
    setSaveError('');
    setSaveSuccess('');
  };

  const saveManagedAccounts = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const originalById = new Map(accounts.map((account) => [account.id, account]));

    try {
      for (const draft of draftAccounts) {
        if (draft.markedForDeletion && draft.id) {
          const response = await fetch(`/api/auth/accounts/${draft.id}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Failed to delete ${draft.name}`);
          }
        }
      }

      for (const draft of draftAccounts) {
        if (draft.markedForDeletion) continue;

        if (draft.isNew) {
          const response = await fetch('/api/auth/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: draft.username,
              name: draft.name,
              password: draft.password,
              role: draft.role,
              customPermissions: draft.customPermissions,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Failed to create ${draft.name || draft.username}`);
          }
          continue;
        }

        if (!draft.id) continue;
        const original = originalById.get(draft.id);
        if (!original) continue;

        const patch: Record<string, unknown> = {};
        if (draft.name !== original.name) patch.name = draft.name;
        if (draft.role !== original.role) patch.role = draft.role;
        if (!arraysEqual(draft.customPermissions, original.customPermissions)) {
          patch.customPermissions = draft.customPermissions;
        }
        if (draft.password) patch.password = draft.password;

        if (Object.keys(patch).length === 0) continue;

        const response = await fetch(`/api/auth/accounts/${draft.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to update ${draft.name}`);
        }
      }

      await fetchAccounts();
      setSaveSuccess('账户修改已保存');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save accounts');
    } finally {
      setIsSaving(false);
    }
  };

  const addLegacyEntry = () => {
    setLegacyEntries((current) => [
      ...current,
      { password: '', name: '', role: 'viewer', customPermissions: [] },
    ]);
  };

  const updateLegacyEntry = (index: number, patch: Partial<LegacyConfigEntry>) => {
    setLegacyEntries((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;
      return {
        ...entry,
        ...patch,
      };
    }));
  };

  const toggleLegacyPermission = (index: number, permission: Permission) => {
    setLegacyEntries((current) => current.map((entry, entryIndex) => {
      if (entryIndex !== index) return entry;
      const nextPermissions = entry.customPermissions.includes(permission)
        ? entry.customPermissions.filter((value) => value !== permission)
        : [...entry.customPermissions, permission];
      return {
        ...entry,
        customPermissions: nextPermissions,
      };
    }));
  };

  const removeLegacyEntry = (index: number) => {
    setLegacyEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const generatedLegacyAccounts = useMemo(() => {
    return legacyEntries
      .filter((entry) => entry.password.trim() && entry.name.trim())
      .map((entry) => {
        let value = `${entry.password.trim()}:${entry.name.trim()}`;
        if (entry.role !== 'viewer' || entry.customPermissions.length > 0) {
          value += `:${entry.role}`;
        }
        if (entry.customPermissions.length > 0) {
          value += `:${entry.customPermissions.join('|')}`;
        }
        return value;
      })
      .join(',');
  }, [legacyEntries]);

  if (!hasAuth && !session) return null;

  return (
    <SettingsSection title="账户管理" description="查看当前登录用户，并根据部署模式管理访问账户。">
      <div className="space-y-6">
        {session && (
          <div className="flex items-center justify-between gap-4 p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-lg border border-[var(--glass-border)]">
                {session.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-color)] truncate">{session.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Shield size={12} className={session.role === 'super_admin' || session.role === 'admin' ? 'text-[var(--accent-color)]' : 'text-[var(--text-color-secondary)]'} />
                  <span className="text-xs text-[var(--text-color-secondary)]">
                    {session.role === 'super_admin' ? '超级管理员' : session.role === 'admin' ? '管理员' : '观众'}
                  </span>
                  {session.username && (
                    <span className="text-xs text-[var(--text-color-secondary)]">
                      @{session.username}
                    </span>
                  )}
                  {session.mode && (
                    <span className="text-xs text-[var(--text-color-secondary)]">
                      {session.mode === 'managed' ? '托管账户模式' : '环境变量模式'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={logoutAndReload}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-[var(--text-color-secondary)] hover:text-red-500 hover:border-red-500/30 transition-all duration-200 cursor-pointer"
            >
              <LogOut size={14} />
              退出登录
            </button>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
          <Info className="text-[var(--text-color-secondary)] shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-color-secondary)]">
              当前登录模式：
              <span className="text-[var(--text-color)] ml-1">
                {isManagedMode ? 'Redis 托管账户' : loginMode === 'legacy_password' ? '环境变量密码登录' : '未启用'}
              </span>
            </p>
            {isManagedMode ? (
              <p className="text-xs text-[var(--text-color-secondary)]">
                托管模式下由超级管理员直接在此页面管理账户，修改会立即写入服务端存储。
              </p>
            ) : (
              <p className="text-xs text-[var(--text-color-secondary)]">
                环境变量模式下可继续使用 <code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ADMIN_PASSWORD</code> 与 <code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ACCOUNTS</code> 配置访问控制。
              </p>
            )}
          </div>
        </div>

        {isManagedMode ? (
          canManageAccounts ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-color)] flex items-center gap-2">
                    <Icons.Users size={16} className="text-[var(--accent-color)]" />
                    账户列表
                  </h3>
                  <p className="text-xs text-[var(--text-color-secondary)] mt-1">
                    支持新增、改权限、重置密码和删除账户。只有点击保存才会提交修改。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={restoreDrafts}
                    disabled={!isDirty || isSaving}
                    className="px-3 py-1.5 text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-[var(--text-color-secondary)] disabled:opacity-50 cursor-pointer"
                  >
                    取消修改
                  </button>
                  <button
                    onClick={saveManagedAccounts}
                    disabled={!isDirty || isSaving}
                    className="px-3 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded-[var(--radius-full)] disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? '保存中...' : '保存修改'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="p-3 rounded-[var(--radius-2xl)] border border-red-500/20 bg-red-500/10 text-sm text-red-400">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-[var(--radius-2xl)] border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-400">
                  {saveSuccess}
                </div>
              )}

              {loadingAccounts ? (
                <div className="p-4 rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm text-[var(--text-color-secondary)]">
                  正在加载账户...
                </div>
              ) : (
                <div className="space-y-4">
                  {currentDraftAccounts.map((account, index) => {
                    const extraPermissions = ALL_PERMISSIONS.filter((permission) => !ROLE_PERMISSIONS[account.role].includes(permission));
                    const isCurrentAccount = session?.accountId === account.id;

                    return (
                      <div
                        key={account.id || `new-${index}`}
                        className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[var(--text-color)]">
                              {account.isNew ? '新账户' : account.name || account.username || '未命名账户'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                              {account.role === 'super_admin' ? '超级管理员' : account.role === 'admin' ? '管理员' : '观众'}
                            </span>
                            {isCurrentAccount && (
                              <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] border border-[var(--glass-border)] text-[var(--text-color-secondary)]">
                                当前账户
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeDraftAccount(index)}
                            disabled={isCurrentAccount}
                            className="p-1 text-[var(--text-color-secondary)] hover:text-red-500 disabled:opacity-50 transition-colors cursor-pointer"
                            title={isCurrentAccount ? '不能删除当前登录账户' : '删除账户'}
                          >
                            <Icons.Trash size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="space-y-1">
                            <span className="text-xs text-[var(--text-color-secondary)]">用户名</span>
                            <input
                              type="text"
                              value={account.username}
                              disabled={!account.isNew}
                              onChange={(event) => updateDraftAccount(index, { username: event.target.value.toLowerCase() })}
                              className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] disabled:opacity-60 focus:outline-none focus:border-[var(--accent-color)]"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-[var(--text-color-secondary)]">显示名称</span>
                            <input
                              type="text"
                              value={account.name}
                              onChange={(event) => updateDraftAccount(index, { name: event.target.value })}
                              className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs text-[var(--text-color-secondary)]">角色</span>
                            <select
                              value={account.role}
                              disabled={isCurrentAccount}
                              onChange={(event) => updateDraftAccount(index, { role: event.target.value as Role })}
                              className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] disabled:opacity-60 focus:outline-none focus:border-[var(--accent-color)]"
                            >
                              <option value="viewer">观众</option>
                              <option value="admin">管理员</option>
                              <option value="super_admin">超级管理员</option>
                            </select>
                          </label>
                        </div>

                        <label className="space-y-1 block">
                          <span className="text-xs text-[var(--text-color-secondary)]">
                            {account.isNew ? '登录密码' : '重置密码（留空表示不修改）'}
                          </span>
                          <input
                            type="password"
                            value={account.password}
                            onChange={(event) => updateDraftAccount(index, { password: event.target.value })}
                            className="w-full px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                          />
                        </label>

                        {extraPermissions.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs text-[var(--text-color-secondary)]">额外权限</span>
                            <div className="flex flex-wrap gap-2">
                              {extraPermissions.map((permission) => {
                                const checked = account.customPermissions.includes(permission);
                                return (
                                  <label
                                    key={permission}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-xs text-[var(--text-color-secondary)] cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleDraftPermission(index, permission)}
                                      className="w-3.5 h-3.5 rounded accent-[var(--accent-color)]"
                                    />
                                    {PERMISSION_LABELS[permission]}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={addDraftAccount}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[var(--glass-bg)] border border-dashed border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-all w-full justify-center cursor-pointer"
                  >
                    <Icons.Plus size={14} />
                    添加账户
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color-secondary)]">
              当前模式已启用托管账户，但只有超级管理员可以查看和修改账户列表。
            </div>
          )
        ) : (
          canManageAccounts && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-color)] flex items-center gap-2">
                    <Icons.Settings size={16} className="text-[var(--accent-color)]" />
                    环境变量账户配置
                  </h3>
                  <p className="text-xs text-[var(--text-color-secondary)] mt-1">
                    兼容旧部署模式。新增或修改后，把生成的 <code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ACCOUNTS</code> 值同步到部署环境。
                  </p>
                </div>
                <button
                  onClick={() => setShowLegacyConfig((current) => !current)}
                  className="text-xs text-[var(--accent-color)] hover:underline cursor-pointer"
                >
                  {showLegacyConfig ? '收起' : '展开'}
                </button>
              </div>

              {accounts.length > 0 && (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between px-4 py-2.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-sm border border-[var(--glass-border)]">
                          {account.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm text-[var(--text-color)]">{account.name}</span>
                          <p className="text-xs text-[var(--text-color-secondary)]">@{account.username}</p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color-secondary)]">
                        {account.role === 'super_admin' ? '超级管理员' : account.role === 'admin' ? '管理员' : '观众'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {showLegacyConfig && (
                <div className="space-y-4 p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
                  {legacyEntries.map((entry, index) => {
                    const extraPermissions = ALL_PERMISSIONS.filter((permission) => !ROLE_PERMISSIONS[entry.role].includes(permission));

                    return (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="密码"
                              value={entry.password}
                              onChange={(event) => updateLegacyEntry(index, { password: event.target.value })}
                              className="px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                            />
                            <input
                              type="text"
                              placeholder="名称"
                              value={entry.name}
                              onChange={(event) => updateLegacyEntry(index, { name: event.target.value })}
                              className="px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                            />
                            <select
                              value={entry.role}
                              onChange={(event) => updateLegacyEntry(index, { role: event.target.value as Role })}
                              className="px-3 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                            >
                              <option value="viewer">观众</option>
                              <option value="admin">管理员</option>
                              <option value="super_admin">超级管理员</option>
                            </select>
                          </div>
                          {extraPermissions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {extraPermissions.map((permission) => (
                                <label
                                  key={permission}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-xs text-[var(--text-color-secondary)] cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={entry.customPermissions.includes(permission)}
                                    onChange={() => toggleLegacyPermission(index, permission)}
                                    className="w-3.5 h-3.5 rounded accent-[var(--accent-color)]"
                                  />
                                  {PERMISSION_LABELS[permission]}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeLegacyEntry(index)}
                          className="p-1.5 text-[var(--text-color-secondary)] hover:text-red-500 transition-colors cursor-pointer mt-1"
                        >
                          <Icons.Trash size={14} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={addLegacyEntry}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] border-dashed rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-all w-full justify-center cursor-pointer"
                  >
                    <Icons.Plus size={12} />
                    添加账户
                  </button>

                  {generatedLegacyAccounts && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--text-color)]">
                        生成的 ACCOUNTS 值
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        <code className="flex-1 px-3 py-2 bg-black/20 border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-xs text-[var(--text-color)] break-all select-all">
                          {generatedLegacyAccounts}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedLegacyAccounts)}
                          className="px-3 py-2 bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] text-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                        >
                          <Icons.Copy size={12} />
                          复制
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </SettingsSection>
  );
}
