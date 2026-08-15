// src/components/layout/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, HandCoins, Building2, FileBarChart, Settings,
  Landmark, LogOut, UserCog, Repeat, SlidersHorizontal, FileText, Upload,
  Globe, ClipboardList, FileBarChart2, Wallet,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import {
  canEnterTenantContext,
  canManageUsers,
  canViewDisbursements,
  canViewOrgRegistry,
  isMfiStaff,
} from '@/lib/permissions';
import type { GlobalUser } from '@/types';

type NavItem = { name: string; href: string; icon: typeof LayoutDashboard };

// Every MFI-role account is always inside their own tenant. Global-scope
// roles (SUPER_ADMIN / AOM_STAFF / DONOR_STAFF) only enter tenant context
// once they've picked an MFI via the TenantSwitcher in the header.
const inTenantContext = (user: GlobalUser | null, selectedMfiId: number | null) =>
  isMfiStaff(user) || (canEnterTenantContext(user) && selectedMfiId !== null);

const tenantNav = (user: GlobalUser | null): NavItem[] => [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Members', href: '/dashboard/members', icon: Users },
  { name: 'Loans', href: '/dashboard/loans', icon: HandCoins },
  { name: 'Repayment Schedules', href: '/dashboard/repayment-schedules', icon: Repeat },
  { name: 'Loan Adjustments', href: '/dashboard/loan-adjustments', icon: SlidersHorizontal },
  { name: 'Loan Documents', href: '/dashboard/loan-documents', icon: FileText },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2 },
  { name: 'Loan Officers', href: '/dashboard/loan-officers', icon: ClipboardList },
  ...(canViewDisbursements(user)
    ? [{ name: 'Funding', href: '/dashboard/funding', icon: Wallet }]
    : []),
  { name: 'Import Data', href: '/dashboard/import', icon: Upload },
  { name: 'Reports', href: '/dashboard/reports', icon: FileBarChart },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// The global/oversight layer: Donor -> AoM -> MFI. Visibility of each
// entry is already enforced by the backend (an AOM_STAFF's /api/donors/
// call returns nothing); this list just decides what's worth a click for
// the current role so no one lands on a screen that's empty by design.
const globalNav = (user: GlobalUser | null): NavItem[] => {
  const items: NavItem[] = [];
  if (canViewOrgRegistry(user)) {
    items.push({ name: 'Organizations', href: '/dashboard/organizations', icon: Globe });
    items.push({
      name: 'Consolidated Reports',
      href: '/dashboard/organizations/reports',
      icon: FileBarChart2,
    });
  }
  if (canManageUsers(user)) {
    items.push({ name: 'Users', href: '/dashboard/organizations/users', icon: UserCog });
  }
  return items;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logoutMutation = useLogout();
  const user = useAuthStore((state) => state.user);
  const selectedMfi = useTenantContext((state) => state.selectedMfi);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    router.push('/login');
  };

  const showTenantNav = inTenantContext(user, selectedMfi?.id ?? null);
  const globalItems = globalNav(user);

  const renderLink = (item: NavItem) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/dashboard' &&
        item.href !== '/dashboard/organizations' &&
        pathname.startsWith(item.href));
    return (
      <Link
        key={item.name}
        href={item.href}
        className={clsx(
          'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200',
          isActive
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <item.icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-white' : 'text-slate-500')} />
        {item.name}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800">
      <div className="flex items-center h-16 px-6 border-b border-slate-800">
        <Landmark className="h-8 w-8 text-indigo-500 mr-3" />
        <span className="text-xl font-bold text-white tracking-tight">LoanTrack</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {globalItems.length > 0 && (
          <div className="mb-4">
            <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              Organization
            </p>
            {globalItems.map(renderLink)}
          </div>
        )}

        {showTenantNav ? (
          <div>
            {globalItems.length > 0 && (
              <p className="px-4 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                {selectedMfi ? selectedMfi.name : 'MFI Operations'}
              </p>
            )}
            {tenantNav(user).map(renderLink)}
          </div>
        ) : (
          globalItems.length > 0 && (
            <p className="px-4 pt-4 text-xs text-slate-600 leading-relaxed">
              Select an MFI above to view its members, loans, and branches.
            </p>
          )
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center px-4 py-3 rounded-xl bg-slate-800/50">
          <div className="flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              {user?.first_name?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">{user?.first_name || user?.username || 'User'}</p>
            <p className="text-xs text-slate-400">{user?.role || 'Staff'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
