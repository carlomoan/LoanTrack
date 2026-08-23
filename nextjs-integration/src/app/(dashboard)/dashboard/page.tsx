// src/app/(dashboard)/dashboard/page.tsx
'use client';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { sharedApi } from '@/api/shared';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useDashboardWidgets } from '@/components/dashboard/widgets';

interface MFISummary {
  id: number;
  name: string;
  schema_name: string;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedMfi, setSelectedMfi } = useTenantContext();

  // For SUPER_ADMIN without MFI, fetch list of MFIs to select from
  const { data: mfis } = useQuery({
    queryKey: ['mfis-for-dashboard'],
    queryFn: () => sharedApi.mfis.list().then(res => res.data.results as MFISummary[]),
    enabled: isSuperAdmin && !user?.mfi,
    staleTime: 5 * 60 * 1000,
  });

  // Effective tenant schema: selected MFI (global roles) or user's own MFI
  const effectiveSchema = selectedMfi?.schema_name || user?.mfi_schema || null;

  const { statWidgets, wideWidgets } = useDashboardWidgets(user, effectiveSchema);

  // SUPER_ADMIN with no MFI and none selected: show MFI picker.
  if (isSuperAdmin && !user?.mfi && !selectedMfi) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome</h1>
          <p className="text-slate-500 mt-1">Select an MFI to view its dashboard</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mfis?.map((mfi) => (
            <div
              key={mfi.id}
              onClick={() => setSelectedMfi({ id: mfi.id, name: mfi.name, schema_name: mfi.schema_name })}
              className="fuse-card p-6 cursor-pointer hover:bg-violet-50 transition-colors border-2 border-slate-200 hover:border-violet-300"
            >
              <Building2 className="h-10 w-10 text-violet-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">{mfi.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Schema: {mfi.schema_name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 mt-1">
            {selectedMfi ? selectedMfi.name : user?.mfi_name || 'Portfolio'} metrics for your role
          </p>
        </div>
        {isSuperAdmin && !user?.mfi && (
          <select
            value={selectedMfi?.schema_name || ''}
            onChange={(e) => {
              const mfi = mfis?.find(m => m.schema_name === e.target.value);
              if (mfi) setSelectedMfi({ id: mfi.id, name: mfi.name, schema_name: mfi.schema_name });
            }}
            className="fuse-input w-fit"
          >
            <option value="">Select MFI...</option>
            {mfis?.map((mfi) => (
              <option key={mfi.id} value={mfi.schema_name}>{mfi.name}</option>
            ))}
          </select>
        )}
      </motion.div>

      {/* Widgets the user has permission to see; anything else is absent,
          never an error. */}
      {statWidgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statWidgets}
        </div>
      )}

      {wideWidgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{wideWidgets}</div>
      )}

      {statWidgets.length === 0 && wideWidgets.length === 0 && (
        <div className="fuse-card p-10 text-center">
          <p className="text-slate-500">
            No dashboard metrics are available for your role yet.
          </p>
        </div>
      )}
    </div>
  );
}