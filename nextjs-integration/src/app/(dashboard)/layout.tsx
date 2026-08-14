import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ShoppingCart, BookOpen } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Fuse-style bottom action bar */}
        <footer className="flex items-center gap-3 border-t border-gray-200 bg-white px-4 py-2.5">
          <button className="fuse-btn-primary">
            <ShoppingCart className="h-4 w-4" /> Generate Monthly Report
          </button>
          <button className="fuse-btn-dark">
            <BookOpen className="h-4 w-4" /> Documentation
          </button>
          <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] font-semibold text-gray-500">
            <span className="rounded bg-sky-100 text-sky-700 px-1.5 py-0.5">Django</span>
            <span className="rounded bg-slate-200 text-slate-700 px-1.5 py-0.5">Next.js</span>
            <span className="rounded bg-cyan-100 text-cyan-700 px-1.5 py-0.5">Tailwind</span>
            <span className="rounded bg-indigo-100 text-indigo-700 px-1.5 py-0.5">PostgreSQL</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
