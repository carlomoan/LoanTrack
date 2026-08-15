// src/context/MFIContext.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { sharedApi } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';

interface MFISummary {
  id: number;
  name: string;
  schema_name: string;
}

interface MFIContextType {
  selectedMFI: MFISummary | null;
  isGlobalMode: boolean;
  mfis: MFISummary[];
  setSelectedMFI: (mfi: MFISummary | null) => void;
  setGlobalMode: () => void;
  effectiveSchema: string | null;
}

const MFIContext = createContext<MFIContextType | undefined>(undefined);

export function MFIProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const { selectedMfi, setSelectedMfi, clearSelectedMfi } = useTenantContext();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Load MFIs for the super-admin switcher
  const { data: mfis = [] } = useQuery({
    queryKey: ['mfis-for-selector'],
    queryFn: () =>
      sharedApi.mfis.list().then((res) => res.data.results as MFISummary[]),
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const isGlobalMode = selectedMfi === null;

  const setSelectedMFI = (mfi: MFISummary | null) => {
    if (mfi) setSelectedMfi(mfi);
    else clearSelectedMfi();
  };

  const setGlobalMode = () => clearSelectedMfi();

  // Mirror the priority used by api/client.ts resolveTenantSubdomain():
  // the logged-in user's own MFI wins, then the explicitly selected tenant.
  const effectiveSchema =
    (user as any)?.mfi_schema || selectedMfi?.schema_name || null;

  return (
    <MFIContext.Provider
      value={{
        selectedMFI: selectedMfi,
        isGlobalMode,
        mfis,
        setSelectedMFI,
        setGlobalMode,
        effectiveSchema,
      }}
    >
      {children}
    </MFIContext.Provider>
  );
}

export function useMFIContext() {
  const context = useContext(MFIContext);
  if (!context) {
    throw new Error('useMFIContext must be used within an MFIProvider');
  }
  return context;
}
