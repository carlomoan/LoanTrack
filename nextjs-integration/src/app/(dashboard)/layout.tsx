// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { MFIProvider } from '@/context/MFIContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <MFIProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
          </div>
        </div>
      </MFIProvider>
    </RequireAuth>
  );
}
