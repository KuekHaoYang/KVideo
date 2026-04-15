export type Role = 'super_admin' | 'admin' | 'viewer';

export type Permission =
  | 'source_management'
  | 'account_management'
  | 'danmaku_api'
  | 'data_management'
  | 'player_settings'
  | 'danmaku_appearance'
  | 'view_settings'
  | 'iptv_access'
  | 'iptv_source_management'
  | 'iptv_builtin_sources';

export const ALL_PERMISSIONS: Permission[] = [
  'source_management',
  'account_management',
  'danmaku_api',
  'data_management',
  'player_settings',
  'danmaku_appearance',
  'view_settings',
  'iptv_access',
  'iptv_source_management',
  'iptv_builtin_sources',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'source_management',
    'account_management',
    'danmaku_api',
    'data_management',
    'player_settings',
    'danmaku_appearance',
    'view_settings',
    'iptv_access',
    'iptv_source_management',
    'iptv_builtin_sources',
  ],
  admin: [
    'player_settings',
    'danmaku_appearance',
    'view_settings',
    'iptv_access',
    'iptv_source_management',
    'iptv_builtin_sources',
  ],
  viewer: ['view_settings'],
};

const ROLE_HIERARCHY: Role[] = ['viewer', 'admin', 'super_admin'];

export function isRole(value: string | undefined | null): value is Role {
  return value === 'viewer' || value === 'admin' || value === 'super_admin';
}

export function normalizeRole(value: string | undefined | null): Role {
  return isRole(value) ? value : 'viewer';
}

export function isPermission(value: string | undefined | null): value is Permission {
  return !!value && ALL_PERMISSIONS.includes(value as Permission);
}

export function normalizePermissions(values: readonly string[] | undefined | null): Permission[] {
  if (!values || values.length === 0) return [];
  return values.filter((value): value is Permission => isPermission(value));
}

export function resolvePermissions(role: Role, customPermissions?: readonly string[] | null): Permission[] {
  const permissions = new Set<Permission>([
    ...(ROLE_PERMISSIONS[role] || []),
    ...normalizePermissions(customPermissions),
  ]);

  if (permissions.has('iptv_access')) {
    permissions.add('iptv_source_management');
  }

  return Array.from(permissions);
}

export function hasResolvedPermission(
  role: Role,
  permission: Permission,
  customPermissions?: readonly string[] | null
): boolean {
  return resolvePermissions(role, customPermissions).includes(permission);
}

export function hasRoleAtLeast(role: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole);
}
