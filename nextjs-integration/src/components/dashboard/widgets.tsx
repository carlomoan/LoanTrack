// src/components/dashboard/widgets.tsx
//
// Dashboard widgets. Each one is self-contained: it declares the
// permission required to be *shown at all*, fetches its own data, and
// degrades to nothing on failure -- so a role without access to some
// slice of the system simply doesn't see that widget, rather than being
// greeted by "not permitted" alerts.
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Landmark, Users, AlertTriangle, TrendingUp, HandCoins,
  Building2, ClipboardList, Wallet, FileBarChart, type LucideIcon,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { tenantApi } from '@/api/tenant';
import { sharedApi } from '@/api/shared';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDefaultCurrency } from '@/hooks/useSystemSettings';
import { canViewDisbursements, canViewOrgRegistry } from '@/lib/permissions';
import type { GlobalUser } from '@/types';

function WidgetShell({
  title, icon: Icon, color, children,
}: {
  title: string; icon: LucideIcon; color: string; children: React.ReactNode;
}) {
  return (
    <div className="fuse-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      {children}
    </div>
  );
}

/** Renders children only while its query is loading; hides itself otherwise. */
function WidgetGate({
  isLoading, isError, children,
}: { isLoading: boolean; isError: boolean; children: React.ReactNode }) {
  if (isError) return null;
  if (isLoading) {
    return <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />;
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Tenant widgets (MFI operational data)
// ---------------------------------------------------------------------------

export function TotalDisbursedWidget({ schema }: { schema: string | null }) {
  const currency = useDefaultCurrency();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['portfolio-summary', schema],
    queryFn: () => tenantApi.loans.summary().then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 60_000,
  });
  const value = parseFloat(data?.portfolio?.total_amount || 0);

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Total Disbursed" icon={Landmark} color="text-violet-600 bg-violet-50">
        <p className="text-2xl font-bold text-slate-900">
          {currency} {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function OutstandingWidget({ schema }: { schema: string | null }) {
  const currency = useDefaultCurrency();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['portfolio-summary', schema],
    queryFn: () => tenantApi.loans.summary().then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 60_000,
  });
  const value = parseFloat(data?.portfolio?.total_outstanding || 0);

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Outstanding Balance" icon={TrendingUp} color="text-blue-600 bg-blue-50">
        <p className="text-2xl font-bold text-slate-900">
          {currency} {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function ActiveLoansWidget({ schema }: { schema: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['portfolio-summary', schema],
    queryFn: () => tenantApi.loans.summary().then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 60_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Active Loans" icon={HandCoins} color="text-emerald-600 bg-emerald-50">
        <p className="text-2xl font-bold text-slate-900">
          {(data?.portfolio?.active_count || 0).toLocaleString()}
        </p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function MembersWidget({ schema }: { schema: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-members-count', schema],
    queryFn: () => tenantApi.members.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 60_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Members" icon={Users} color="text-violet-600 bg-violet-50">
        <p className="text-2xl font-bold text-slate-900">{(data?.count || 0).toLocaleString()}</p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function BranchesWidget({ schema }: { schema: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-branches-count', schema],
    queryFn: () => tenantApi.branches.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 300_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Branches" icon={Building2} color="text-amber-600 bg-amber-50">
        <p className="text-2xl font-bold text-slate-900">{data?.count || 0}</p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function LoanOfficersWidget({ schema }: { schema: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-officers-count', schema],
    queryFn: () => tenantApi.loanOfficers.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 300_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Loan Officers" icon={ClipboardList} color="text-cyan-600 bg-cyan-50">
        <p className="text-2xl font-bold text-slate-900">{data?.count || 0}</p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function DisbursementTrendsWidget({ schema }: { schema: string | null }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['monthly-trends', schema],
    queryFn: () => tenantApi.reports.monthlyTrends().then((r) => r.data),
    retry: false,
    enabled: !!schema,
    staleTime: 120_000,
  });

  if (isError) return null;

  return (
    <div className="lg:col-span-2 fuse-card p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Disbursement Trends</h3>
      {isLoading ? (
        <div className="h-72 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.monthly_disbursements || []}>
              <defs>
                <linearGradient id="colorDisbursed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }} />
              <Area type="monotone" dataKey="total_amount" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorDisbursed)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global widgets (oversight layer)
// ---------------------------------------------------------------------------

export function MfiCountWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-mfi-count'],
    queryFn: () => sharedApi.mfis.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
    staleTime: 300_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="Registered MFIs" icon={Building2} color="text-violet-600 bg-violet-50">
        <p className="text-2xl font-bold text-slate-900">{data?.count || 0}</p>
      </WidgetShell>
    </WidgetGate>
  );
}

export function MfiReportsWidget() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['widget-mfi-reports-count'],
    queryFn: () => sharedApi.mfiReports.list({ page_size: 1 }).then((r) => r.data),
    retry: false,
    staleTime: 120_000,
  });

  return (
    <WidgetGate isLoading={isLoading} isError={isError}>
      <WidgetShell title="MFI Reports" icon={FileBarChart} color="text-emerald-600 bg-emerald-50">
        <p className="text-2xl font-bold text-slate-900">{data?.count || 0}</p>
      </WidgetShell>
    </WidgetGate>
  );
}

// ---------------------------------------------------------------------------
// Widget composition per role
// ---------------------------------------------------------------------------

/**
 * The set of widgets a given user sees. This is the permission-driven
 * dashboard: each list only contains widgets backed by endpoints the
 * role can actually call, so nothing renders as an error or an alert.
 */
export function useDashboardWidgets(user: GlobalUser | null, schema: string | null) {
  const isMfiStaffRole =
    user && ['MFI_ADMIN', 'MFI_MANAGER', 'LOAN_OFFICER'].includes(user.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const inTenant = !!schema && (Boolean(isMfiStaffRole) || Boolean(isSuperAdmin));

  const statWidgets: React.ReactNode[] = [];
  const wideWidgets: React.ReactNode[] = [];

  // Tenant-level widgets need both permission and an active tenant context.
  if (inTenant) {
    statWidgets.push(
      <TotalDisbursedWidget key="disbursed" schema={schema} />,
      <ActiveLoansWidget key="active-loans" schema={schema} />,
      <OutstandingWidget key="outstanding" schema={schema} />,
      <MembersWidget key="members" schema={schema} />,
      <BranchesWidget key="branches" schema={schema} />,
      <LoanOfficersWidget key="officers" schema={schema} />,
    );
    wideWidgets.push(<DisbursementTrendsWidget key="trends" schema={schema} />);
  }

  // Global oversight widgets.
  if (canViewOrgRegistry(user)) {
    statWidgets.push(
      <MfiCountWidget key="mfi-count" />,
      <MfiReportsWidget key="mfi-reports" />,
    );
  }

  // Funding visibility is its own permission.
  if (canViewDisbursements(user) && inTenant) {
    // Funding summary could go here as a dedicated widget later.
  }

  return { statWidgets, wideWidgets };
}