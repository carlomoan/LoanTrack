'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, PieChart, Banknote, Coins, Users, Building2,
  CalendarDays, Settings, Landmark, Info, ChevronUp, GraduationCap, Sparkles,
  Globe, Shield, Key, Menu, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useLogout } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useMFIContext } from '@/context/MFIContext';
import { sharedApi } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setTenantSchema } = useAuthStore();
  const logout = useLogout();
  const { hasPermission, role } = usePermissions();
  const { selectedMFI, isGlobalMode, mfis, setSelectedMFI, setGlobalMode } = useMFIContext();

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.push('/login');
  };

  const handleMFISelect = (mfi: any) => {
    setSelectedMFI(mfi);
    router.push('/dashboard');
  };

  const handleGlobalMode = () => {
    setGlobalMode();
    router.push('/dashboard');
  };

  // Navigation items with permission checks
  const getNavigation = () => {
    const dashboards = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'reports:read' },
      { name: 'Analytics', href: '/dashboard/reports', icon: PieChart, permission: 'reports:read' },
      { name: 'Finance', href: '/dashboard/loans', icon: Banknote, permission: 'loans:read' },
      { name: 'Repayments', href: '/dashboard/repayment-schedules', icon: Coins, permission: 'loans:read' },
    ];

    const applications = [
      { name: 'Members', href: '/dashboard/members', icon: Users, permission: 'members:read' },
      { name: 'Branches', href: '/dashboard/branches', icon: Building2, permission: 'branches:read' },
      { name: 'Loan Officers', href: '/dashboard/loan-officers', icon: GraduationCap, permission: 'loan-officers:read' },
      { name: 'Loan Documents', href: '/dashboard/loan-documents', icon: Sparkles, permission: 'loans:read' },
      { name: 'Loan Adjustments', href: '/dashboard/loan-adjustments', icon: Shield, permission: 'loans:write' },
    ];

    const admin = [
      { name: 'Users', href: '/dashboard/users', icon: GraduationCap, permission: 'users:read' },
      { name: 'Settings', href: '/dashboard/settings', icon: Settings, permission: 'settings:read' },
    ];

    return { dashboards, applications, admin };
  };

  const { dashboards, applications, admin } = getNavigation();

  const filterByPermission = (items: any[]) => {
    if (isSuperAdmin) return items; // Superadmin sees all
    return items.filter(item => hasPermission(item.permission as any));
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#f8f9fb] border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16">
        <div className="flex items-center gap-2">
          <Landmark className="h-7 w-7 text-[#2196f3]" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900">LoanTrack</p>
            <p className="text-[10px] text-gray-500 -mt-0.5">MFI Suite</p>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <Select
              value={isGlobalMode ? 'global' : (selectedMFI?.schema_name || 'global')}
              onValueChange={(value) => {
                if (value === 'global') {
                  handleGlobalMode();
                } else {
                  const mfi = mfis?.find(m => m.schema_name === value);
                  if (mfi) handleMFISelect(mfi);
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={isGlobalMode ? 'Global Mode' : 'Select MFI...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Global Mode (All MFIs)
                  </span>
                </SelectItem>
                {mfis?.map((mfi) => (
                  <SelectItem key={mfi.id} value={mfi.schema_name}>
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {mfi.name} ({mfi.schema_name})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        <div>
          <p className="fuse-section-title px-2">Dashboards</p>
          <p className="fuse-section-sub px-2 mb-2">Unique dashboard designs</p>
          <div className="space-y-0.5">
            {filterByPermission(dashboards).map((item) => (
              <Link key={item.name} href={item.href}
                className={clsx('fuse-nav-item', pathname === item.href && 'active')}>
                <item.icon className="h-4.5 w-4.5 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="fuse-section-title px-2">Applications</p>
          <p className="fuse-section-sub px-2 mb-2">Custom made application designs</p>
          <div className="space-y-0.5">
            {filterByPermission(applications).map((item) => (
              <Link key={item.name} href={item.href}
                className={clsx('fuse-nav-item', pathname === item.href && 'active')}>
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="fuse-section-title px-2">Administration</p>
          <p className="fuse-section-sub px-2 mb-2">System administration</p>
          <div className="space-y-0.5">
            {filterByPermission(admin).map((item) => (
              <Link key={item.name} href={item.href}
                className={clsx('fuse-nav-item', pathname === item.href && 'active')}>
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-[#2196f3] text-white text-xs font-bold flex items-center justify-center">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {user?.first_name || user?.username || 'User'} {user?.last_name || ''}
          </p>
          <p className="truncate text-xs text-gray-500">
            {user?.role || 'Staff'}
          </p>
        </div>
        <button className="fuse-icon-btn" title="Logout" onClick={handleLogout}>
          <Info className="h-4 w-4" />
        </button>
        <ChevronUp className="h-4 w-4 text-gray-400" />
      </div>
    </aside>
  );
}