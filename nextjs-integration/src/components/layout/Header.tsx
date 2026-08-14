'use client';

import {
  PanelLeft, CalendarDays, Mail, Users, Star, Languages, Type,
  Maximize2, Sun, Search, Bookmark, Bell, Building2, Globe
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useMFIContext } from '@/context/MFIContext';

export function Header() {
  const { user } = useAuthStore();
  const { role } = usePermissions();
  const { selectedMFI, isGlobalMode } = useMFIContext();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-[#f8f9fb] px-4 md:px-6">
      <div className="flex items-center gap-1">
        <button className="fuse-icon-btn"><PanelLeft className="h-5 w-5" /></button>
        <div className="ml-2 hidden md:flex items-center gap-1">
          <button className="fuse-icon-btn"><CalendarDays className="h-5 w-5" /></button>
          <button className="fuse-icon-btn"><Mail className="h-5 w-5" /></button>
          <button className="fuse-icon-btn"><Users className="h-5 w-5" /></button>
          <button className="fuse-icon-btn"><Star className="h-5 w-5 text-amber-400" /></button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {/* MFI Context Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm">
          {isSuperAdmin ? (
            <span className="flex items-center gap-1.5 text-orange-600">
              <Globe className="h-4 w-4" />
              <span className="font-medium">{isGlobalMode ? 'Global Mode' : (selectedMFI?.name || 'Select MFI')}</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded">SUPER ADMIN</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-blue-600">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{user?.mfi_name || 'MFI'}</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded">{user?.role}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative hidden md:block w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search loans, members, branches..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all"
          />
        </div>

        <button className="fuse-icon-btn relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#2196f3]" />
        </button>
      </div>
    </header>
  );
}