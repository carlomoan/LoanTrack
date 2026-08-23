// src/components/layout/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Landmark, LogOut, Settings, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { globalNav, tenantNav, visibleNav, hasTenantContext, type NavItem } from '@/lib/nav';
import type { GlobalUser } from '@/types';

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

  // Only items this user may actually use are rendered at all -- no
  // disabled links, no "no permission" placeholders.
  const showTenantNav = hasTenantContext(user, selectedMfi?.id ?? null);
  const globalItems = visibleNav(globalNav(user), user);
  const tenantItems = visibleNav(tenantNav(user), user);

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
        className={clsx('fuse-nav-item', isActive && 'active')}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1">{item.name}</span>
        {isActive && <ChevronRight className="h-4 w-4 shrink-0" />}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-white text-gray-700 border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <Landmark className="h-7 w-7 text-[#696cff] mr-2.5" />
        <div className="leading-tight">
          <p className="text-lg font-bold text-gray-900 tracking-tight">LoanTrack</p>
          <p className="text-[10px] text-gray-400 -mt-0.5">MFI Suite</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {globalItems.length > 0 && (
          <div className="mb-2">
            <p className="fuse-section-title">Organization</p>
            {globalItems.map(renderLink)}
          </div>
        )}

        {showTenantNav ? (
          <div>
            <p className="fuse-section-title">
              {selectedMfi ? selectedMfi.name : 'MFI Operations'}
            </p>
            {tenantItems.map(renderLink)}
          </div>
        ) : (
          globalItems.length > 0 && (
            <p className="px-4 pt-3 text-xs text-gray-500 leading-relaxed">
              Select an MFI above to view its members, loans, and branches.
            </p>
          )
        )}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-3 rounded-xl bg-[#f4f6fa] p-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[#696cff] flex items-center justify-center text-white text-sm font-bold">
            {user?.first_name?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {user?.first_name || user?.username || 'User'}
            </p>
            <p className="truncate text-xs text-gray-500">{user?.role || 'Staff'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <Link
          href="/dashboard/settings"
          className={clsx(
            'mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/dashboard/settings')
              ? 'text-[#696cff] bg-[#696cff]/[0.06]'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </div>
    </aside>
  );
}