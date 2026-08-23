// src/components/layout/Breadcrumbs.tsx
//
// NiceAdmin shows a breadcrumb trail above page content. This derives it
// from the current pathname -- no per-page wiring needed.
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  members: 'Members',
  loans: 'Loans',
  branches: 'Branches',
  reports: 'Reports',
  settings: 'Settings',
  users: 'Users',
  organizations: 'Organizations',
  currency: 'Currency',
  geography: 'Geography',
  funding: 'Funding',
  activity: 'Activity',
  import: 'Import Data',
  new: 'New',
  view: 'View',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = LABELS[seg] ?? decodeURIComponent(seg);
    return { href, label };
  });

  return (
    <nav className="fuse-breadcrumb mb-4" aria-label="Breadcrumb">
      <Link href="/dashboard" className="flex items-center gap-1">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          {i < crumbs.length - 1 ? (
            <Link href={c.href}>{c.label}</Link>
          ) : (
            <span className="current">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}