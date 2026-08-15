// src/components/layout/Header.tsx
'use client';
import { Search, Bell, Plus, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { isMfiStaff, canWriteTenantData } from '@/lib/permissions';
import { TenantSwitcher } from './TenantSwitcher';

export function Header() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const selectedMfi = useTenantContext((state) => state.selectedMfi);

  // "New Loan" only makes sense once we're actually inside a tenant
  // context (either the user's own MFI, or one a global-role user has
  // selected via the switcher) and their role can write tenant data.
  const inTenantContext = isMfiStaff(user) || Boolean(selectedMfi);
  const showNewLoan = inTenantContext && canWriteTenantData(user);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <button className="lg:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100">
          <Menu className="h-6 w-6" />
        </button>

        <div className="relative hidden md:block w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search loans, members, or branches..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TenantSwitcher />

        {showNewLoan && (
          <button
            onClick={() => router.push('/dashboard/loans/new')}
            className="fuse-btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Loan</span>
          </button>
        )}

        <button className="p-2 rounded-full text-slate-500 hover:bg-slate-100 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
      </div>
    </header>
  );
}
