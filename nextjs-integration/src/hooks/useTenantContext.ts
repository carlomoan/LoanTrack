// src/hooks/useTenantContext.ts
//
// Lets a global-scope user (SUPER_ADMIN, AOM_STAFF, DONOR_STAFF -- none of
// whom have a fixed `mfi`) choose which MFI's tenant data to view. MFI-role
// users (MFI_ADMIN / MFI_MANAGER / LOAN_OFFICER) never need this: their own
// `user.mfi_schema` always wins in api/client.ts's tenant resolution.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SelectedTenant {
  id: number;
  name: string;
  schema_name: string;
}

interface TenantContextState {
  selectedMfi: SelectedTenant | null;
  setSelectedMfi: (mfi: SelectedTenant) => void;
  clearSelectedMfi: () => void;
}

export const useTenantContext = create<TenantContextState>()(
  persist(
    (set) => ({
      selectedMfi: null,
      setSelectedMfi: (mfi) => set({ selectedMfi: mfi }),
      clearSelectedMfi: () => set({ selectedMfi: null }),
    }),
    { name: 'tenant-context-storage' }
  )
);
