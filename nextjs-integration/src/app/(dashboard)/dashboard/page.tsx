'use client';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import { StatCard } from '@/components/dashboard/StatCard';
import { Landmark, Users, AlertTriangle, TrendingUp, HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => tenantApi.loans.summary().then(res => res.data),
    retry: false,
  });

  const { data: trends } = useQuery({
    queryKey: ['monthly-trends'],
    queryFn: () => tenantApi.reports.monthlyTrends().then(res => res.data),
    retry: false,
  });

  const portfolio = summary?.portfolio || {};
  const disbursed = parseFloat(portfolio.total_amount || 0);
  const outstanding = parseFloat(portfolio.total_outstanding || 0);
  const activeLoans = portfolio.active_count || 0;

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-slate-500 mt-1">Real-time consolidated portfolio metrics</p>
        </div>
        <button className="fuse-btn-primary w-fit">Generate Monthly Report</button>
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
