// src/components/auth/PermissionGuard.tsx
'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  requiredPermission,
  requiredPermissions,
  fallback,
}: PermissionGuardProps) {
  const router = useRouter();
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasAccess = () => {
    if (requiredPermission) {
      return hasPermission(requiredPermission as any);
    }
    if (requiredPermissions) {
      return hasAllPermissions(requiredPermissions as any);
    }
    return true;
  };

  useEffect(() => {
    if (!hasAccess()) {
      router.push('/dashboard');
    }
  }, [hasAccess, router]);

  if (!hasAccess()) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-full">
          <Card className="text-center max-w-md">
            <CardContent className="py-12">
              <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">Access Denied</h3>
              <p className="text-slate-500 mt-2">
                You don&apos;t have permission to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    );
  }

  return <>{children}</>;
}