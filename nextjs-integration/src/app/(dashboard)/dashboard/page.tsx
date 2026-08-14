'use client';
import { useQuery } from '@tanstack/react-query';
import { tenantApi, crossTenantApi } from '@/api/tenant';
import { sharedApi } from '@/api/shared';
import { StatCard } from '@/components/dashboard/StatCard';
import { Landmark, Users, AlertTriangle, TrendingUp, HandCoins, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useState } from 'react';
import { useMFIContext } from '@/context/MFIContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface MFISummary {
  id: number;
  name: string;
  schema_name: string;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedMFI, isGlobalMode, mfis: contextMfis, setSelectedMFI, setGlobalMode, effectiveSchema } = useMFIContext();
  const [localSelectedMFI, setLocalSelectedMFI] = useState<MFISummary | null>(selectedMFI);

  // For SUPER_ADMIN without MFI, fetch list of MFIs to select from
  const { data: mfis } = useQuery({
    queryKey: ['mfis-for-dashboard'],
    queryFn: () => sharedApi.mfis.list().then(res => res.data.results as MFISummary[]),
    enabled: isSuperAdmin && !user?.mfi,
    staleTime: 5 * 60 * 1000,
  });

  // Sync local state with context
  if (selectedMFI !== localSelectedMFI) {
    setLocalSelectedMFI(selectedMFI);
  }

  const handleMFIChange = (value: string) => {
    if (value === 'global') {
      // Handle global mode if needed
      return;
    }
    const mfi = mfis?.find(m => m.schema_name === value);
    if (mfi) {
      setLocalSelectedMFI(mfi);
    }
  };

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['portfolio-summary', effectiveSchema],
    queryFn: () => tenantApi.loans.summary().then(res => res.data),
    retry: false,
    enabled: !!effectiveSchema,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['monthly-trends', effectiveSchema],
    queryFn: () => tenantApi.reports.monthlyTrends().then(res => res.data),
    retry: false,
    enabled: !!effectiveSchema,
  });

  const portfolio = summary?.portfolio || {};
  const disbursed = parseFloat(portfolio.total_amount || 0);
  const outstanding = parseFloat(portfolio.total_outstanding || 0);
  const activeLoans = portfolio.active_count || 0;

  const isLoading = summaryLoading || trendsLoading;

  if (isSuperAdmin && !user?.mfi && !selectedMFI && !isGlobalMode) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 mt-1">Select an MFI to view dashboard</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {contextMfis?.map((mfi) => (
            <div
              key={mfi.id}
              onClick={() => setLocalSelectedMFI(mfi)}
              className="fuse-card p-6 cursor-pointer hover:bg-indigo-50 transition-colors border-2 border-slate-200 hover:border-indigo-300"
            >
              <Building2 className="h-10 w-10 text-indigo-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">{mfi.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Schema: {mfi.schema_name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  if (summaryError && !effectiveSchema) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load dashboard data</p>
        <p className="text-sm text-slate-500 mt-1">Please select an MFI</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 mt-1">Real-time consolidated portfolio metrics</p>
        </div>
        {isSuperAdmin && !user?.mfi && (
          <div className="flex items-center gap-2">
            <Select
              value={isGlobalMode ? 'global' : (selectedMFI?.schema_name || '')}
              onValueChange={(value) => {
                if (value === 'global') {
                  // Handle global mode
                } else {
                  const mfi = mfis?.find(m => m.schema_name === value);
                  if (mfi) setLocalSelectedMFI(mfi);
                }
              }}
              className="fuse-input w-fit"
            >
              <option value="global">Global Mode</option>
              {contextMfis?.map((mfi) => (
                <option key={mfi.id} value={mfi.schema_name}>{mfi.name}</option>
              ))}
            </Select>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Disbursed" value={disbursed} prefix="TZS " icon={Landmark} color="text-indigo-600 bg-indigo-50" />
        <StatCard title="Active Loans" value={activeLoans} icon={HandCoins} color="text-emerald-600 bg-emerald-50" />
        <StatCard title="Outstanding Balance" value={outstanding} prefix="TZS " icon={TrendingUp} color="text-blue-600 bg-blue-50" />
        <StatCard title="Portfolio at Risk (>30)" value={4.2} suffix="%" icon={AlertTriangle} color="text-rose-600 bg-rose-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 fuse-card p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Disbursement Trends</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends?.monthly_disbursements || []}>
                <defs>
                  <linearGradient id="colorDisbursed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} />
                <Area type="monotone" dataKey="total_amount" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorDisbursed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}