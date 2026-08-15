'use client';

import { useState } from 'react';
import { Building2, ChevronDown, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useMFIs } from '@/hooks/useSharedData';
import { isSuperAdmin } from '@/lib/permissions';

/**
 * Lets SUPER_ADMIN / AOM_STAFF / DONOR_STAFF pick which MFI's tenant data
 * to view -- these roles have no fixed MFI of their own, unlike
 * MFI_ADMIN / MFI_MANAGER / LOAN_OFFICER, whose tenant is always their own
 * and never needs picking. The list is already scoped server-side (an
 * AOM_STAFF only ever sees their own AoM's MFIs), so every option here is
 * one the backend will actually allow.
 */
export function TenantSwitcher() {
  const user = useAuthStore((state) => state.user);
  const selectedMfi = useTenantContext((state) => state.selectedMfi);
  const setSelectedMfi = useTenantContext((state) => state.setSelectedMfi);
  const clearSelectedMfi = useTenantContext((state) => state.clearSelectedMfi);
  const [open, setOpen] = useState(false);

  // Only SUPER_ADMIN can browse into an arbitrary MFI's tenant data.
  // AoM/Donor staff never see individual member/loan records at all --
  // their oversight is MFIReport (aggregate) and MFIDisbursement (the
  // wholesale ledger), never raw tenant data -- and MFI-role users are
  // always already inside their own tenant with nothing to switch.
  if (!isSuperAdmin(user)) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      >
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="max-w-[160px] truncate">
          {selectedMfi ? selectedMfi.name : 'Select an MFI'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {selectedMfi && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            clearSelectedMfi();
          }}
          title="Leave tenant context"
          className="absolute -right-2 -top-2 h-5 w-5 flex items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-900"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {open && (
        <TenantSwitcherMenu
          onClose={() => setOpen(false)}
          onSelect={(mfi) => {
            setSelectedMfi(mfi);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TenantSwitcherMenu({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (mfi: { id: number; name: string; schema_name: string }) => void;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useMFIs({ search: search || undefined, page_size: 20 });

  return (
    <>
      {/* Click-outside catcher */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="p-2 border-b border-slate-100">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MFIs..."
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
          )}
          {!isLoading && data?.results?.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">No MFIs found</div>
          )}
          {data?.results?.map((mfi) => (
            <button
              key={mfi.id}
              onClick={() =>
                onSelect({ id: mfi.id, name: mfi.name, schema_name: mfi.schema_name })
              }
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex flex-col"
            >
              <span className="font-medium text-slate-900">{mfi.name}</span>
              <span className="text-xs text-slate-400">{mfi.code}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
