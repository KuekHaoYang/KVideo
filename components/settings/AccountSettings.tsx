'use client';

import { useState, useEffect } from 'react';
import { getSession, clearSession, hasPermission, type Role, type Permission } from '@/lib/store/auth-store';
import { SettingsSection } from './SettingsSection';
import { Icons } from '@/components/ui/Icon';
import { LogOut, Shield, Info } from 'lucide-react';

interface AccountInfo {
  name: string;
  role: Role;
  customPermissions?: string[];
}

interface ConfigEntry {
  password: string;
  name: string;
  role: Role;
  customPermissions: Permission[];
}

const ALL_PERMISSIONS: { key: Permission; label: string }[] = [
  { key: 'source_management', label: '视频源管理' },
  { key: 'account_management', label: '账户管理' },
  { key: 'danmaku_api', label: '弹幕 API' },
  { key: 'data_management', label: '数据管理' },
  { key: 'player_settings', label: '播放器设置' },
  { key: 'danmaku_appearance', label: '弹幕外观' },
  { key: 'iptv_access', label: 'IPTV 访问' },
  { key: 'iptv_source_management', label: 'IPTV 自定义源管理' },
  { key: 'iptv_builtin_sources', label: 'IPTV 内置源' },
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ['source_management', 'account_management', 'danmaku_api', 'data_management', 'player_settings', 'danmaku_appearance', 'view_settings', 'iptv_access', 'iptv_source_management', 'iptv_builtin_sources'],
  admin: ['player_settings', 'danmaku_appearance', 'view_settings', 'iptv_access', 'iptv_source_management', 'iptv_builtin_sources'],
  viewer: ['view_settings'],
};

export function AccountSettings() {
  const [session, setSessionState] = useState<ReturnType<typeof getSession>>(null);
  const [hasAuth, setHasAuth] = useState(false);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [showConfigGen, setShowConfigGen] = useState(false);
  const [configEntries, setConfigEntries] = useState<ConfigEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [removedAccounts, setRemovedAccounts] = useState<Set<number>>(new Set());
  const [hasAdminPassword, setHasAdminPassword] = useState(false);

  useEffect(() => {
    setSessionState(getSession());

    fetch('/api/auth')
      .then(res => res.json())
      .then(data => setHasAuth(data.hasAuth))
      .catch(() => { });

    // Fetch account list for admins
    fetch('/api/auth/accounts')
      .then(res => res.json())
      .then(data => {
        if (data.accounts) setAccounts(data.accounts);
        if (data.hasAdminPassword) setHasAdminPassword(data.hasAdminPassword);
      })
      .catch(() => { });
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.reload();
  };

  const canManageAccounts = hasPermission('account_management');

  // Config generator helpers
  const addConfigEntry = () => {
    setConfigEntries([...configEntries, { password: '', name: '', role: 'viewer', customPermissions: [] }]);
  };

  const updateConfigEntry = (index: number, field: keyof ConfigEntry, value: string) => {
    const updated = [...configEntries];
    updated[index] = { ...updated[index], [field]: value };
    setConfigEntries(updated);
  };

  const toggleConfigPermission = (index: number, perm: Permission) => {
    const updated = [...configEntries];
    const entry = updated[index];
    const perms = entry.customPermissions || [];
    if (perms.includes(perm)) {
      entry.customPermissions = perms.filter(p => p !== perm);
    } else {
      entry.customPermissions = [...perms, perm];
    }
    setConfigEntries(updated);
  };

  const removeConfigEntry = (index: number) => {
    setConfigEntries(configEntries.filter((_, i) => i !== index));
  };

  const generateAccountsString = () => {
    return configEntries
      .filter(e => e.password.trim() && e.name.trim())
      .map(e => {
        let str = `${e.password}:${e.name}`;
        const hasCustomPerms = e.customPermissions && e.customPermissions.length > 0;
        if (e.role !== 'viewer' || hasCustomPerms) {
          str += ':' + e.role;
        }
        if (hasCustomPerms) {
          str += ':' + e.customPermissions.join('|');
        }
        return str;
      })
      .join(',');
  };

  const handleCopy = () => {
    const str = generateAccountsString();
    navigator.clipboard.writeText(str).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Load existing accounts into config generator (without passwords)
  const loadExistingAccounts = () => {
    // Filter out removed accounts and the standalone admin password account
    const existingEntries: ConfigEntry[] = accounts
      .filter((_, i) => !removedAccounts.has(i))
      .filter(a => !(a.name === '超级管理员' && hasAdminPassword))
      .map(a => ({
        password: '',
        name: a.name,
        role: a.role,
        customPermissions: (a.customPermissions || []) as Permission[],
      }));
    setConfigEntries(existingEntries);
    setShowConfigGen(true);
  };

  // Remove account from visible list and track removal
  const handleRemoveAccount = (index: number) => {
    setRemovedAccounts(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  // Get visible accounts (excluding removed ones)
  const visibleAccounts = accounts.filter((_, i) => !removedAccounts.has(i));

  if (!hasAuth && !session) return null;

  return (
    <SettingsSection title="账户管理" description="查看当前登录用户信息和账户配置。">
      <div className="space-y-6">
        {/* Current User Info */}
        {session && (
          <div className="flex items-center justify-between p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-lg border border-[var(--glass-border)]">
                {session.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-color)]">{session.name}</p>
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className={session.role === 'super_admin' || session.role === 'admin' ? 'text-[var(--accent-color)]' : 'text-[var(--text-color-secondary)]'} />
                  <span className="text-xs text-[var(--text-color-secondary)]">
                    {session.role === 'super_admin' ? '超级管理员' : session.role === 'admin' ? '管理员' : '观众'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-[var(--text-color-secondary)] hover:text-red-500 hover:border-red-500/30 transition-all duration-200 cursor-pointer"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          </div>
        )}

        {/* Account List (Account managers only) */}
        {canManageAccounts && visibleAccounts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--text-color)] mb-3 flex items-center gap-2">
              <Icons.Users size={16} className="text-[var(--accent-color)]" />
              已配置的账户
            </h3>
            <div className="space-y-2">
              {accounts.map((account, index) => {
                if (removedAccounts.has(index)) return null;
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-2.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[var(--radius-full)] bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-sm border border-[var(--glass-border)]">
                        {account.name.charAt(0)}
                      </div>
                      <span className="text-sm text-[var(--text-color)]">{account.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-[var(--radius-full)] ${account.role === 'super_admin' || account.role === 'admin'
                          ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                          : 'bg-[var(--glass-bg)] text-[var(--text-color-secondary)] border border-[var(--glass-border)]'
                        }`}>
                        {account.role === 'super_admin' ? '超级管理员' : account.role === 'admin' ? '管理员' : '观众'}
                      </span>
                      <button
                        onClick={() => handleRemoveAccount(index)}
                        className="p-1 text-[var(--text-color-secondary)] hover:text-red-500 transition-colors cursor-pointer"
                        title="移除账户"
                      >
                        <Icons.Trash size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notice when accounts have been removed */}
            {removedAccounts.size > 0 && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-2xl)]">
                <p className="text-xs text-amber-400">
                  已标记移除 {removedAccounts.size} 个账户。请使用下方配置生成器生成新的 <code className="px-1 py-0.5 bg-black/20 rounded text-[10px]">ACCOUNTS</code> 环境变量值并更新部署配置。
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    onClick={loadExistingAccounts}
                    className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-[var(--radius-2xl)] transition-colors cursor-pointer"
                  >
                    生成新配置
                  </button>
                  <button
                    onClick={() => setRemovedAccounts(new Set())}
                    className="text-xs px-3 py-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color-secondary)] hover:text-[var(--text-color)] rounded-[var(--radius-2xl)] transition-colors cursor-pointer"
                  >
                    撤销
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config Generator (Account managers only) */}
        {canManageAccounts && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-color)] flex items-center gap-2">
                <Icons.Settings size={16} className="text-[var(--accent-color)]" />
                配置生成器
              </h3>
              <div className="flex items-center gap-2">
                {!showConfigGen && accounts.length > 0 && (
                  <button
                    onClick={loadExistingAccounts}
                    className="text-xs text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
                  >
                    导入现有账户
                  </button>
                )}
                <button
                  onClick={() => setShowConfigGen(!showConfigGen)}
                  className="text-xs text-[var(--accent-color)] hover:underline cursor-pointer"
                >
                  {showConfigGen ? '收起' : '展开'}
                </button>
              </div>
            </div>

            {showConfigGen && (
              <div className="space-y-4 p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
                <p className="text-xs text-[var(--text-color-secondary)]">
                  添加账户条目后，将生成的 <code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ACCOUNTS</code> 环境变量值复制到部署配置中。
                  {configEntries.some(e => !e.password && e.name) && (
                    <span className="text-amber-400 block mt-1">
                      注意：导入的账户需要重新输入密码。
                    </span>
                  )}
                </p>

                {/* Entry List */}
                {configEntries.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="密码"
                          value={entry.password}
                          onChange={(e) => updateConfigEntry(index, 'password', e.target.value)}
                          className={`flex-1 px-3 py-1.5 bg-[var(--glass-bg)] border rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)] ${!entry.password && entry.name ? 'border-amber-500/50' : 'border-[var(--glass-border)]'
                            }`}
                        />
                        <input
                          type="text"
                          placeholder="名称"
                          value={entry.name}
                          onChange={(e) => updateConfigEntry(index, 'name', e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-sm text-[var(--text-color)] placeholder:text-[var(--text-color-secondary)]/50 focus:outline-none focus:border-[var(--accent-color)]"
                        />
                        <select
                          value={entry.role}
                          onChange={(e) => updateConfigEntry(index, 'role', e.target.value)}
                          className="px-2 py-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-xs text-[var(--text-color)] focus:outline-none focus:border-[var(--accent-color)]"
                        >
                          <option value="viewer">观众</option>
                          <option value="admin">管理员</option>
                          <option value="super_admin">超级管理员</option>
                        </select>
                      </div>
                      {/* Custom permissions: show only those not in the selected role */}
                      {(() => {
                        const rolePerms = ROLE_PERMISSIONS[entry.role] || [];
                        const extraPerms = ALL_PERMISSIONS.filter(p => !rolePerms.includes(p.key));
                        if (extraPerms.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1.5 pl-1">
                            {extraPerms.map(p => {
                              const checked = entry.customPermissions?.includes(p.key) ?? false;
                              return (
                                <label key={p.key} className="flex items-center gap-1 text-[10px] text-[var(--text-color-secondary)] cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleConfigPermission(index, p.key)}
                                    className="w-3 h-3 rounded accent-[var(--accent-color)]"
                                  />
                                  {p.label}
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => removeConfigEntry(index)}
                      className="p-1.5 text-[var(--text-color-secondary)] hover:text-red-500 transition-colors cursor-pointer mt-1"
                    >
                      <Icons.Trash size={14} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addConfigEntry}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] border-dashed rounded-[var(--radius-2xl)] text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] hover:border-[var(--accent-color)]/30 transition-all w-full justify-center cursor-pointer"
                >
                  <Icons.Plus size={12} />
                  添加账户
                </button>

                {/* Generated Output */}
                {configEntries.length > 0 && configEntries.some(e => e.password && e.name) && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-color)]">
                      生成的 ACCOUNTS 值：
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <code className="flex-1 px-3 py-2 bg-black/20 border border-[var(--glass-border)] rounded-[var(--radius-2xl)] text-xs text-[var(--text-color)] break-all select-all">
                        {generateAccountsString()}
                      </code>
                      <button
                        onClick={handleCopy}
                        className="px-3 py-2 bg-[var(--accent-color)] text-white rounded-[var(--radius-2xl)] text-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                      >
                        <Icons.Copy size={12} />
                        {copied ? '已复制' : '复制'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Config Notice */}
        <div className="flex items-start gap-3 p-4 bg-[color-mix(in_srgb,var(--accent-color)_5%,transparent)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)]">
          <Info className="text-[var(--text-color-secondary)] shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-color-secondary)]">
              账户通过环境变量配置：
            </p>
            <div className="text-xs text-[var(--text-color-secondary)] space-y-0.5">
              <p><code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ADMIN_PASSWORD</code> — 单管理员密码</p>
              <p><code className="px-1 py-0.5 bg-[var(--glass-bg)] rounded text-[10px]">ACCOUNTS</code> — 多账户（密码:名称[:角色[:权限1|权限2]]）</p>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
