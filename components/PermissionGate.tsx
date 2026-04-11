'use client';

import { hasPermission, type Permission } from '@/lib/store/auth-store';

interface PermissionGateProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
