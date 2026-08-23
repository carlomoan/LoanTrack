// src/app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { RequireAuth } from '@/components/auth/RequireAuth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-[#f4f6fa]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <Breadcrumbs />
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}