'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useSharedData';

/**
 * Real counts from /api/notifications/summary/, polled every minute --
 * not a static badge. Each item links to where the user can actually act
 * on it (approve a report, record an overdue repayment).
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data } = useNotifications();

  const total = data?.total ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full text-slate-500 hover:bg-slate-100 relative"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-red-500 rounded-full border-2 border-white">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {(!data || data.items.length === 0) && (
                <div className="px-4 py-6 text-sm text-slate-400 text-center">
                  Nothing needs your attention right now.
                </div>
              )}
              {data?.items.map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="text-slate-700">{item.label}</span>
                  <span className="ml-2 flex-shrink-0 text-xs font-semibold text-white bg-violet-500 rounded-full px-2 py-0.5">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
