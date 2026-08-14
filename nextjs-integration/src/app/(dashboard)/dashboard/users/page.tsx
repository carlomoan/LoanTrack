'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi, crossTenantApi } from '@/api/tenant';
import { sharedApi } from '@/api/shared';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Bell, Mail, Settings, MoreVertical, ChevronRight } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, PieChart, Pie, Cell,
} from 'recharts';

const fmt = (n: any) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n || 0));

const COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336'];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState('home');
  const [range, setRange] = useState<'week' | 'last'>('week');
  const [selectedMFI, setSelectedMFI] = useState('');

  const { data: mfis } = useQuery({
    queryKey: ['mfis-for-dashboard'],
    queryFn: () => sharedApi.mfis.list().then((r) => r.data.results),
    enabled: isSuperAdmin && !user?.mfi,
  });

  const { data: summary } = useQuery({
    queryKey: ['portfolio-summary', selectedMFI],
    queryFn: () => tenantApi.loans.summary().then((r) => r.data),
    retry: false,
  });

  const { data: trends } = useQuery({
    queryKey: ['monthly-trends', selectedMFI],
    queryFn: () => tenantApi.reports.monthlyTrends().then((r) => r.data),
    retry: false,
  });

  const { data: overdue } = useQuery({
    queryKey: ['overdue-count'],
    queryFn: () => tenantApi.repaymentSchedules.overdue().then((r) => r.data),
    retry: false,
  });

  const { data: adjustments } = useQuery({
    queryKey: ['pending-adjustments'],
    queryFn: () => tenantApi.loanAdjustments.list({ is_approved: false }).then((r) => r.data),
    retry: false,
  });

  const { data: members } = useQuery({
    queryKey: ['members-count'],
    queryFn: () => tenantApi.members.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
  });

  const { data: schedules } = useQuery({
    queryKey: ['due-schedules'],
    queryFn: () => tenantApi.repaymentSchedules.list({ is_paid: false, page_size: 5 }).then((r) => r.data),
    retry: false,
  });

  const p = (summary as any)?.portfolio || {};
  const chartData = (trends?.monthly_disbursements || []).map((d: any, i: number) => ({
    name: (d.month || '').slice(5) || `M${i + 1}`,
    disbursed: Number(d.total_amount || 0),
    repaid: Number(trends?.monthly_repayments?.[i]?.total_paid || 0),
  }));

  const distribution = ((summary as any)?.by_status?.length
    ? (summary as any).by_status.map((s: any) => ({ name: s.status, value: s.count }))
    : [
        { name: 'ACT', value: p.active_count || 0 },
        { name: 'PND', value: Math.max(0, (p.total_loans || 0) - (p.active_count || 0)) },
        { name: 'CLS', value: 0 },
        { name: 'DEF', value: 0 },
      ]
  ).filter((x: any) => x.value > 0);

  const dueList = schedules?.results || [];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Breadcrumb */}
      <div className="fuse-breadcrumb">
        Home <ChevronRight className="h-3 w-3" /> Dashboards <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-gray-900">Project</span>
      </div>

      {/* Welcome header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[#2196f3] text-white text-lg font-bold flex items-center justify-center">
            {(user?.first_name?.[0] || 'U').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.first_name || user?.username || 'User'} {user?.last_name || ''}!
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
              <Bell className="h-4 w-4" /> You have 2 new messages and 15 new tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="fuse-btn-dark"><Mail className="h-4 w-4" /> Messages</button>
          <button className="fuse-btn-primary"><Settings className="h-4 w-4" /> Settings</button>
        </div>
      </div>

      {/* Tabs + tenant selector */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="fuse-segmented">
          {['home', 'budget', 'team'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {isSuperAdmin && !user?.mfi && (
          <select className="fuse-input w-56" value={selectedMFI} onChange={(e) => setSelectedMFI(e.target.value)}>
            <option value="">ACME Corp. Backend App</option>
            {mfis?.map((m: any) => (
              <option key={m.id} value={m.schema_name}>{m.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Today', value: dueList.length, label: 'Due Installments', foot: ['Completed', 7] },
          { title: 'Overdue', value: overdue?.count || overdue?.results?.length || 0, label: 'Tasks', foot: ["Yesterday's overdue", 2] },
          { title: 'Issues', value: adjustments?.count || adjustments?.results?.length || 0, label: 'Open', foot: ['Closed today', 0] },
          { title: 'Features', value: members?.count || 0, label: 'Members', foot: ['Implemented', 8] },
        ].map((c, i) => (
          <div key={i} className="fuse-card p-4">
            <div className="flex items-center justify-between">
              {i === 0 ? (
                <span className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700">Today ▾</span>
              ) : (
                <span className="text-sm text-gray-600">{c.title}</span>
              )}
              <button className="fuse-icon-btn"><MoreVertical className="h-4 w-4" /></button>
            </div>
            <div className="py-5 text-center">
              <p className="text-5xl font-extrabold tracking-tight text-gray-900">{c.value}</p>
              <p className="mt-2 text-sm text-gray-600">{c.label}</p>
            </div>
            <p className="pt-2 text-center text-sm text-gray-500">
              {c.foot[0]}: <span className="font-semibold text-gray-800">{c.foot[1]}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Portfolio summary card */}
      <div className="fuse-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Portfolio Issues Summary</h3>
          <div className="fuse-segmented">
            <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>This Week</button>
            <button className={range === 'last' ? 'active' : ''} onClick={() => setRange('last')}>Last Week</button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Combo chart */}
          <div>
            <p className="mb-4 text-sm text-gray-600">Disbursed vs. Repaid</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="disbursed" fill="#2196f3" barSize={24} radius={[2, 2, 0, 0]} />
                  <Line dataKey="repaid" stroke="#111827" strokeWidth={2} dot={{ r: 2 }}>
                    <LabelList dataKey="repaid" position="top" fill="#111827" fontSize={10} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overview boxes */}
          <div>
            <p className="mb-4 text-sm text-gray-600">Overview</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-gray-100 p-6 text-center">
                <p className="text-4xl font-extrabold text-[#2196f3]">{fmt(p.total_loans)}</p>
                <p className="mt-1 text-sm font-medium text-[#2196f3]">New Loans</p>
              </div>
              <div className="rounded-xl bg-gray-100 p-6 text-center">
                <p className="text-4xl font-extrabold text-[#2196f3]">{fmt(p.active_count)}</p>
                <p className="mt-1 text-sm font-medium text-[#2196f3]">Active</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                ['Fixed', (summary as any)?.water_component?.count || 0],
                ["Won't Fix", 0],
                ['Re-opened', 0],
                ['Needs Triage', 0],
              ].map(([label, v], i) => (
                <div key={i} className="rounded-xl bg-gray-100 p-4 text-center">
                  <p className="text-xl font-bold text-gray-800">{v}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: distribution + schedule */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="fuse-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Loan Distribution</h3>
            <div className="fuse-segmented">
              <button className="active">This Week</button>
              <button>Last Week</button>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={40} outerRadius={90} paddingAngle={2}>
                  {distribution.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fuse-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Schedule</h3>
            <div className="fuse-segmented">
              <button className="active">Today</button>
              <button>Tomorrow</button>
            </div>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {dueList.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-500">No upcoming installments</p>
            )}
            {dueList.slice(0, 4).map((s: any) => (
              <button key={s.id} className="flex w-full items-center justify-between py-3.5 text-left hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Installment #{s.installment_number} — {s.loan_number || `Loan ${s.loan}`}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">in 32 minutes • {s.due_date}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
