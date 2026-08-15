import type { QueryParams } from '@/types';

const withParams = (base: readonly string[], params?: QueryParams) =>
  params ? [...base, params] : [...base];

export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },

  shared: {
    donors: (params?: QueryParams) => withParams(['shared', 'donors'], params),
    donor: (id: number) => ['shared', 'donor', id] as const,

    aoms: (params?: QueryParams) => withParams(['shared', 'aoms'], params),
    aom: (id: number) => ['shared', 'aom', id] as const,

    mfis: (params?: QueryParams) => withParams(['shared', 'mfis'], params),
    mfi: (id: number) => ['shared', 'mfi', id] as const,
    mfiSchemaInfo: (id: number) => ['shared', 'mfi', id, 'schema-info'] as const,

    domains: (params?: QueryParams) => withParams(['shared', 'domains'], params),
    domain: (id: number) => ['shared', 'domain', id] as const,

    users: (params?: QueryParams) => withParams(['shared', 'users'], params),
    user: (id: number) => ['shared', 'user', id] as const,

    exchangeRates: (params?: QueryParams) =>
      withParams(['shared', 'exchange-rates'], params),
    exchangeRate: (id: number) => ['shared', 'exchange-rate', id] as const,

    mfiReports: (params?: QueryParams) =>
      withParams(['shared', 'mfi-reports'], params),
    mfiReport: (id: number) => ['shared', 'mfi-report', id] as const,

    aomReports: (params?: QueryParams) =>
      withParams(['shared', 'aom-reports'], params),
    aomReport: (id: number) => ['shared', 'aom-report', id] as const,

    donorReports: (params?: QueryParams) =>
      withParams(['shared', 'donor-reports'], params),
    donorReport: (id: number) => ['shared', 'donor-report', id] as const,

    donorContributions: (params?: QueryParams) =>
      withParams(['shared', 'donor-contributions'], params),

    mfiDisbursements: (params?: QueryParams) =>
      withParams(['shared', 'mfi-disbursements'], params),
    mfiDisbursement: (id: number) => ['shared', 'mfi-disbursement', id] as const,

    disbursementRepayments: (params?: QueryParams) =>
      withParams(['shared', 'disbursement-repayments'], params),
  },

  tenant: {
    regions: (params?: QueryParams) => withParams(['tenant', 'regions'], params),
    region: (id: number) => ['tenant', 'region', id] as const,

    districts: (params?: QueryParams) => withParams(['tenant', 'districts'], params),
    district: (id: number) => ['tenant', 'district', id] as const,

    wards: (params?: QueryParams) => withParams(['tenant', 'wards'], params),
    ward: (id: number) => ['tenant', 'ward', id] as const,

    streets: (params?: QueryParams) => withParams(['tenant', 'streets'], params),
    street: (id: number) => ['tenant', 'street', id] as const,

    branches: (params?: QueryParams) => withParams(['tenant', 'branches'], params),
    branch: (id: number) => ['tenant', 'branch', id] as const,

    loanOfficers: (params?: QueryParams) =>
      withParams(['tenant', 'loan-officers'], params),
    loanOfficer: (id: number) => ['tenant', 'loan-officer', id] as const,

    members: (params?: QueryParams) => withParams(['tenant', 'members'], params),
    member: (id: number) => ['tenant', 'member', id] as const,
    memberLoans: (id: number) => ['tenant', 'member', id, 'loans'] as const,

    loans: (params?: QueryParams) => withParams(['tenant', 'loans'], params),
    loan: (id: number) => ['tenant', 'loan', id] as const,
    loanSummary: (params?: QueryParams) =>
      withParams(['tenant', 'loans', 'summary'], params),
    loanHistory: (id: number) => ['tenant', 'loan', id, 'history'] as const,

    repaymentSchedules: (params?: QueryParams) =>
      withParams(['tenant', 'repayment-schedules'], params),
    repaymentSchedule: (id: number) =>
      ['tenant', 'repayment-schedule', id] as const,
    overdueSchedules: (params?: QueryParams) =>
      withParams(['tenant', 'repayment-schedules', 'overdue'], params),

    loanAdjustments: (params?: QueryParams) =>
      withParams(['tenant', 'loan-adjustments'], params),
    loanAdjustment: (id: number) => ['tenant', 'loan-adjustment', id] as const,

    loanDocuments: (params?: QueryParams) =>
      withParams(['tenant', 'loan-documents'], params),
    loanDocument: (id: number) => ['tenant', 'loan-document', id] as const,

    portfolioSummary: (params?: QueryParams) =>
      withParams(['tenant', 'reports', 'portfolio-summary'], params),
    monthlyTrends: (params?: QueryParams) =>
      withParams(['tenant', 'reports', 'monthly-trends'], params),
  },

  crossTenant: {
    mfiReports: (params?: QueryParams) =>
      withParams(['cross-tenant', 'mfi-reports'], params),
    cachedReport: (
      type: 'mfi' | 'aom' | 'donor',
      entityId: number,
      period: string
    ) => ['cross-tenant', 'cached-report', type, entityId, period] as const,
  },
};
