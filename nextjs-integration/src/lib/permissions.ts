// src/lib/permissions.ts
//
// Frontend mirror of core/permissions.py's role model. This does NOT
// replace backend authorization -- the API enforces the real rules and
// must be trusted as the source of truth. This file exists so the UI can
// hide actions the backend would reject anyway (approve buttons, admin
// screens, other-org data) instead of showing them and then failing with
// a 403 after the user has already tried.
//
// Keep this in sync with core/permissions.py by hand; there is currently
// no shared schema between the two.

import type { GlobalUser, UserRole } from '@/types';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  AOM_STAFF: 'AOM_STAFF',
  DONOR_STAFF: 'DONOR_STAFF',
  MFI_ADMIN: 'MFI_ADMIN',
  MFI_MANAGER: 'MFI_MANAGER',
  LOAN_OFFICER: 'LOAN_OFFICER',
} as const;

export const MFI_STAFF_ROLES: UserRole[] = [
  ROLES.MFI_ADMIN,
  ROLES.MFI_MANAGER,
  ROLES.LOAN_OFFICER,
];

export const MFI_WRITE_ROLES: UserRole[] = [ROLES.MFI_ADMIN, ROLES.MFI_MANAGER];

export const hasRole = (user: GlobalUser | null, ...roles: UserRole[]): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};

export const isSuperAdmin = (user: GlobalUser | null) => hasRole(user, ROLES.SUPER_ADMIN);
export const isAomStaff = (user: GlobalUser | null) => hasRole(user, ROLES.AOM_STAFF);
export const isDonorStaff = (user: GlobalUser | null) => hasRole(user, ROLES.DONOR_STAFF);
export const isMfiStaff = (user: GlobalUser | null) => hasRole(user, ...MFI_STAFF_ROLES);

// --- Mirrors of the specific rules in core/permissions.py -------------

/** Donor / AoM registry screens: SUPER_ADMIN full access, AOM_STAFF/DONOR_STAFF read their own only, MFI roles: none. */
export const canViewOrgRegistry = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF, ROLES.DONOR_STAFF);

export const canEditDonor = (user: GlobalUser | null) => isSuperAdmin(user);

export const canEditAom = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF);

export const canEditMfi = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF);

/** Separation of duty: MFI staff submit reports, only AoM staff/super admin approve them. */
export const canApproveMfiReport = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF);

export const canApproveAomReport = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.DONOR_STAFF);

export const canApproveDonorReport = (user: GlobalUser | null) => isSuperAdmin(user);

/** Tenant (MFI operational) data: only SUPER_ADMIN and the MFI's own staff -- AoM/Donor oversight goes through MFIReport and MFIDisbursement instead, never direct member/loan access. */
export const canEnterTenantContext = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN) || isMfiStaff(user);

export const canWriteTenantData = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.MFI_ADMIN, ROLES.MFI_MANAGER, ROLES.LOAN_OFFICER);

export const canDeleteTenantData = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.MFI_ADMIN, ROLES.MFI_MANAGER);

export const canManageUsers = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF, ROLES.MFI_ADMIN);

export const canEditExchangeRates = (user: GlobalUser | null) => isSuperAdmin(user);

// --- Fund flow: Donor -> AoM -> MFI -------------------------------------
// The wholesale layer above individual lending. MFI roles get read-only
// visibility into their own MFI's disbursements (what they owe upward)
// but never edit the AoM's ledger.

export const canManageDonorContributions = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.DONOR_STAFF);

export const canViewDonorContributions = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.DONOR_STAFF, ROLES.AOM_STAFF);

export const canManageDisbursements = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF);

export const canViewDisbursements = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF, ROLES.DONOR_STAFF, ...MFI_WRITE_ROLES);

export const canRecordDisbursementPayment = (user: GlobalUser | null) =>
  hasRole(user, ROLES.SUPER_ADMIN, ROLES.AOM_STAFF);
