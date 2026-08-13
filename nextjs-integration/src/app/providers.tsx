// src/app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { useAuthBootstrap } from '@/hooks/useAuth';

function AuthBootstrap({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  return <>{children}</>;
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
        {children}
        <Toaster position="top-right" richColors closeButton />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
