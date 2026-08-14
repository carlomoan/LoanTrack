'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { sharedApi } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';
import { setTenantSchema, getTenantSchema } from '@/api/client';

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
  const { user, setTenantSchema } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  // Load MFIs for superadmin
  const { data: mfis = [] } = useQuery({
    queryKey: ['mfis-for-selector'],
    queryFn: () => sharedApi.mfis.list().then(res => res.data.results as MFISummary[]),
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Initialize from localStorage
  const [selectedMFI, setSelectedMFIState] = useState<MFISummary | null>(null);
  const [isGlobalMode, setIsGlobalModeState] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSchema = getTenantSchema();
      if (storedSchema && storedSchema !== 'global') {
        const mfi = mfis.find(m => m.schema_name === storedSchema);
        if (mfi) {
          setSelectedMFIState(mfi);
          setIsGlobalModeState(false);
        }
      }
    }
  }, [mfis]);

  const setSelectedMFI = (mfi: MFISummary | null) => {
    setSelectedMFIState(mfi);
    if (mfi) {
      setIsGlobalModeState(false);
      setTenantSchema(mfi.schema_name);
    } else {
      setIsGlobalModeState(true);
      setTenantSchema('global');
    }
  };

  const setGlobalMode = () => {
    setSelectedMFIState(null);
    setIsGlobalModeState(true);
    setTenantSchema('global');
  };

  const effectiveSchema = selectedMFI?.schema_name || user?.mfi_schema || (isGlobalMode ? null : getTenantSchema());

  return (
    <MFIContext.Provider value={{
      selectedMFI,
      isGlobalMode,
      mfis,
      setSelectedMFI,
      setGlobalMode,
      effectiveSchema,
    }}>
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