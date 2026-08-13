// src/components/layout/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, HandCoins, Building2, FileBarChart, Settings, Landmark, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useLogout } from '@/hooks/useAuth';
import { useAuthStore } from '@/hooks/useAuthStore';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Members', href: '/dashboard/members', icon: Users },
  { name: 'Loans', href: '/dashboard/loans', icon: HandCoins },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2 },
  { name: 'Reports', href: '/dashboard/reports', icon: FileBarChart },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logoutMutation = useLogout();
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    router.push('/login');
  };

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800">
      <div className="flex items-center h-16 px-6 border-b border-slate-800">
        <Landmark className="h-8 w-8 text-indigo-500 mr-3" />
        <span className="text-xl font-bold text-white tracking-tight">LoanTrack</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
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
        })}
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
