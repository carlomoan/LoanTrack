// src/app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';
import { setForbiddenHandler, setSessionExpiredHandler } from '@/api/client';

function AuthBootstrap({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
}

function GlobalApiHandlers() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    // Every 403 the app receives goes through here -- role/tenant access
    // was denied by the backend, and there's no retry that fixes it.
    setForbiddenHandler(() => {
      toast.error("You don't have permission to do that.");
    });

    // Refresh token was invalid/expired: the session is over.
    setSessionExpiredHandler(() => {
      logout();
      router.push('/login');
    });

    return () => {
      setForbiddenHandler(null);
      setSessionExpiredHandler(null);
    };
  }, [router, logout]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <GlobalApiHandlers />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
