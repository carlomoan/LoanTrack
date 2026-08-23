// src/lib/nav.ts
//
// Single source of truth for role-gated navigation, shared by the
// Sidebar and the command palette (Cmd+K) so they can never drift out
// of sync -- a role that can't see a link in the sidebar won't see it
// as a searchable command either.
//
// Every entry carries a `can` predicate. A nav item with no permission
// for the current user is FILTERED OUT entirely -- never rendered as a
// disabled link or a "no access" placeholder -- so users only ever see
// destinations that will actually work for them.
import {
  LayoutDashboard, Users, HandCoins, Building2, FileBarChart, Settings,
  UserCog, Repeat, SlidersHorizontal, FileText, Upload,
  Globe, ClipboardList, FileBarChart2, Wallet, MapPin, DollarSign, History,
} from 'lucide-react';
import {
  canManageUsers,
  canViewDisbursements,
  canViewOrgRegistry,
  canEnterTenantContext,
  isMfiStaff,
} from '@/lib/permissions';
import type { GlobalUser } from '@/types';

export type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Return false to hide this item completely for the current user. */
  can?: (user: GlobalUser | null) => boolean;
};

const always = () => true;

export const tenantNav = (user: GlobalUser | null): NavItem[] => [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, can: always },
  { name: 'Members', href: '/dashboard/members', icon: Users, can: (u) => Boolean(u) },
  { name: 'Loans', href: '/dashboard/loans', icon: HandCoins, can: (u) => Boolean(u) },
  { name: 'Repayment Schedules', href: '/dashboard/repayment-schedules', icon: Repeat, can: (u) => Boolean(u) },
  { name: 'Loan Adjustments', href: '/dashboard/loan-adjustments', icon: SlidersHorizontal, can: (u) => Boolean(u) },
  { name: 'Loan Documents', href: '/dashboard/loan-documents', icon: FileText, can: (u) => Boolean(u) },
  { name: 'Branches', href: '/dashboard/branches', icon: Building2, can: (u) => Boolean(u) },
  { name: 'Loan Officers', href: '/dashboard/loan-officers', icon: ClipboardList, can: (u) => Boolean(u) },
  { name: 'Geography', href: '/dashboard/geography', icon: MapPin, can: (u) => Boolean(u) },
  { name: 'Activity', href: '/dashboard/activity', icon: History, can: (u) => Boolean(u) },
  { name: 'Funding', href: '/dashboard/funding', icon: Wallet, can: canViewDisbursements },
  { name: 'Import Data', href: '/dashboard/import', icon: Upload, can: (u) => Boolean(u) },
  { name: 'Reports', href: '/dashboard/reports', icon: FileBarChart, can: (u) => Boolean(u) },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, can: (u) => Boolean(u) },
];

// The global/oversight layer: Donor -> AoM -> MFI. Visibility of each
// entry mirrors what the backend enforces; anything not permitted is
// removed rather than shown disabled.
export const globalNav = (user: GlobalUser | null): NavItem[] => [
  { name: 'Organizations', href: '/dashboard/organizations', icon: Globe, can: canViewOrgRegistry },
  {
    name: 'Consolidated Reports',
    href: '/dashboard/organizations/reports',
    icon: FileBarChart2,
    can: canViewOrgRegistry,
  },
  { name: 'Currency', href: '/dashboard/organizations/currency', icon: DollarSign, can: canViewOrgRegistry },
  { name: 'Users', href: '/dashboard/organizations/users', icon: UserCog, can: canManageUsers },
];

/** Filter a nav list down to only items the user may actually use. */
export const visibleNav = (items: NavItem[], user: GlobalUser | null): NavItem[] =>
  items.filter((item) => (item.can ? item.can(user) : true));

/**
 * Whether the user has any tenant-level navigation at all. MFI-role staff
 * are always inside their own tenant; global roles enter one via the
 * TenantSwitcher.
 */
export const hasTenantContext = (
  user: GlobalUser | null,
  selectedMfiId: number | null
): boolean => isMfiStaff(user) || (canEnterTenantContext(user) && selectedMfiId !== null);