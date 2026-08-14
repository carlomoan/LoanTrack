// src/hooks/usePermissions.ts
import { useAuthStore } from './useAuthStore';

export type Permission =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'mfis:read'
  | 'mfis:write'
  | 'donors:read'
  | 'donors:write'
  | 'aoms:read'
  | 'aoms:write'
  | 'reports:read'
  | 'reports:write'
  | 'reports:approve'
  | 'settings:read'
  | 'settings:write'
  | 'loans:read'
  | 'loans:write'
  | 'members:read'
  | 'members:write'
  | 'branches:read'
  | 'branches:write'
  | 'loan-officers:read'
  | 'loan-officers:write';

const rolePermissions: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'users:read', 'users:write', 'users:delete',
    'mfis:read', 'mfis:write',
    'donors:read', 'donors:write',
    'aoms:read', 'aoms:write',
    'reports:read', 'reports:write', 'reports:approve',
    'settings:read', 'settings:write',
    'loans:read', 'loans:write',
    'members:read', 'members:write',
    'branches:read', 'branches:write',
    'loan-officers:read', 'loan-officers:write',
  ],
  AOM_STAFF: [
    'users:read', 'users:write',
    'mfis:read', 'mfis:write',
    'donors:read',
    'aoms:read', 'aoms:write',
    'reports:read', 'reports:write',
    'settings:read',
    'loans:read', 'loans:write',
    'members:read', 'members:write',
    'branches:read', 'branches:write',
    'loan-officers:read', 'loan-officers:write',
  ],
  DONOR_STAFF: [
    'users:read',
    'mfis:read',
    'donors:read',
    'aoms:read',
    'reports:read',
    'settings:read',
    'loans:read',
    'members:read',
    'branches:read',
    'loan-officers:read',
  ],
  MFI_ADMIN: [
    'users:read', 'users:write',
    'mfis:read',
    'reports:read', 'reports:write',
    'settings:read', 'settings:write',
    'loans:read', 'loans:write',
    'members:read', 'members:write',
    'branches:read', 'branches:write',
    'loan-officers:read', 'loan-officers:write',
  ],
  MFI_MANAGER: [
    'users:read',
    'mfis:read',
    'reports:read', 'reports:write',
    'settings:read',
    'loans:read', 'loans:write',
    'members:read', 'members:write',
    'branches:read', 'branches:write',
    'loan-officers:read', 'loan-officers:write',
  ],
  LOAN_OFFICER: [
    'users:read',
    'mfis:read',
    'reports:read',
    'settings:read',
    'loans:read', 'loans:write',
    'members:read', 'members:write',
    'branches:read',
    'loan-officers:read',
  ],
};

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role || '';

  const hasPermission = (permission: Permission): boolean => {
    const permissions = rolePermissions[role] || [];
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every((p) => hasPermission(p));
  };

  const canAccessRoute = (route: string): boolean => {
    const routePermissions: Record<string, Permission[]> = {
      '/dashboard': ['reports:read'],
      '/dashboard/members': ['members:read'],
      '/dashboard/loans': ['loans:read'],
      '/dashboard/branches': ['branches:read'],
      '/dashboard/reports': ['reports:read'],
      '/dashboard/users': ['users:read'],
      '/dashboard/settings': ['settings:read'],
      '/dashboard/loan-officers': ['loan-officers:read'],
      '/dashboard/loan-documents': ['loans:read'],
      '/dashboard/loan-adjustments': ['loans:write'],
      '/dashboard/repayment-schedules': ['loans:read'],
      '/dashboard/import': ['loans:write'],
    };

    const required = routePermissions[route] || [];
    return required.length === 0 || hasAnyPermission(required);
  };

  return {
    role,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
  };
}

export function useRole() {
  const user = useAuthStore((state) => state.user);
  return user?.role || '';
}