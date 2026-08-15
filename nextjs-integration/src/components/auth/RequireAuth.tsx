'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useAuthBootstrap } from '@/hooks/useAuth';

/**
 * Wraps any route tree that requires a logged-in user. Without this,
 * navigating straight to a dashboard URL works for anyone, authenticated
 * or not -- the page just renders and lets its data fetches fail one by
 * one. This redirects to /login before that happens.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { isLoading, isFetching } = useAuthBootstrap();

  const stillResolving = isLoading || (isAuthenticated && isFetching);

  useEffect(() => {
    if (!stillResolving && !isAuthenticated) {
      router.replace('/login');
    }
  }, [stillResolving, isAuthenticated, router]);

  if (stillResolving) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect above is in flight; render nothing rather than flashing
    // protected content.
    return null;
  }

  return <>{children}</>;
}
