// src/app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from 'next-themes';
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
  const queryClient = useQueryClient();

  useEffect(() => {
    // Every 403 the app receives goes through here -- role/tenant access
    // was denied by the backend, and there's no retry that fixes it.
    setForbiddenHandler(() => {
      toast.error("You don't have permission to do that.");
    });

    // Refresh token was invalid/expired: the session is over. Clear the
    // cache here too, not just on an explicit logout click -- the next
    // person to log in on this tab must not see whatever the expired
    // session had cached.
    setSessionExpiredHandler(() => {
      logout();
      queryClient.clear();
      router.push('/login');
    });

    return () => {
      setForbiddenHandler(null);
      setSessionExpiredHandler(null);
    };
  }, [router, logout, queryClient]);

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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <GlobalApiHandlers />
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthBootstrap>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
