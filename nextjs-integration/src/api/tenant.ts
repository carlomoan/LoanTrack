import api from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import type {
  Region,
  District,
  Ward,
  Street,
  Branch,
  LoanOfficer,
  Member,
  Loan,
  RepaymentSchedule,
  LoanAdjustment,
  LoanDocument,
  PaginatedResponse,
  MemberForm,
  LoanForm,
  AdjustmentForm,
  DocumentForm,
  MFIReportPayload,
  TenantPortfolioSummaryResponse,
  MonthlyTrends,
  ActivityFeedResponse,
  GeocodeReverseResult,
} from '@/types';

// Tenant/Isolated Schema API
export const tenantApi = {
  // Map reverse geocoding (Django fetches coordinates from OSM)
  geocode: {
    reverse: (lat: number, lng: number) =>
      api.get<GeocodeReverseResult>('/tenant/geocode/reverse/', { params: { lat, lng } }),
  },

  // Geography
  regions: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Region>>('/tenant/regions/', { params }),
    get: (id: number) =>
      api.get<Region>(`/tenant/regions/${id}/`),
    create: (data: Partial<Region>) =>
      api.post<Region>('/tenant/regions/', data),
    update: (id: number, data: Partial<Region>) =>
      api.patch<Region>(`/tenant/regions/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/regions/${id}/`),
  },

  districts: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<District>>('/tenant/districts/', { params }),
    get: (id: number) =>
      api.get<District>(`/tenant/districts/${id}/`),
    create: (data: Partial<District>) =>
      api.post<District>('/tenant/districts/', data),
    update: (id: number, data: Partial<District>) =>
      api.patch<District>(`/tenant/districts/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/districts/${id}/`),
  },

  wards: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Ward>>('/tenant/wards/', { params }),
    get: (id: number) =>
      api.get<Ward>(`/tenant/wards/${id}/`),
    create: (data: Partial<Ward>) =>
      api.post<Ward>('/tenant/wards/', data),
    update: (id: number, data: Partial<Ward>) =>
      api.patch<Ward>(`/tenant/wards/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/wards/${id}/`),
  },

  streets: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Street>>('/tenant/streets/', { params }),
    get: (id: number) =>
      api.get<Street>(`/tenant/streets/${id}/`),
    create: (data: Partial<Street>) =>
      api.post<Street>('/tenant/streets/', data),
    update: (id: number, data: Partial<Street>) =>
      api.patch<Street>(`/tenant/streets/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/streets/${id}/`),
  },

  // Branches
  branches: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Branch>>('/tenant/branches/', { params }),
    get: (id: number) =>
      api.get<Branch>(`/tenant/branches/${id}/`),
    create: (data: Partial<Branch>) =>
      api.post<Branch>('/tenant/branches/', data),
    update: (id: number, data: Partial<Branch>) =>
      api.patch<Branch>(`/tenant/branches/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/branches/${id}/`),
  },

  // Loan Officers
  loanOfficers: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<LoanOfficer>>('/tenant/loan-officers/', { params }),
    get: (id: number) =>
      api.get<LoanOfficer>(`/tenant/loan-officers/${id}/`),
    create: (data: Partial<LoanOfficer>) =>
      api.post<LoanOfficer>('/tenant/loan-officers/', data),
    update: (id: number, data: Partial<LoanOfficer>) =>
      api.patch<LoanOfficer>(`/tenant/loan-officers/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/loan-officers/${id}/`),
  },

  // Members
  members: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Member>>('/tenant/members/', { params }),
    get: (id: number) =>
      api.get<Member>(`/tenant/members/${id}/`),
    create: (data: MemberForm) =>
      api.post<Member>('/tenant/members/', data),
    update: (id: number, data: Partial<MemberForm>) =>
      api.patch<Member>(`/tenant/members/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/members/${id}/`),
    getLoans: (memberId: number) =>
      api.get<Loan[]>(`/tenant/members/${memberId}/loans/`),
  },

  // Loans
  loans: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Loan>>('/tenant/loans/', { params }),
    get: (id: number) =>
      api.get<Loan>(`/tenant/loans/${id}/`),
    create: (data: LoanForm) =>
      api.post<Loan>('/tenant/loans/', data),
    update: (id: number, data: Partial<LoanForm>) =>
      api.patch<Loan>(`/tenant/loans/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/loans/${id}/`),
    softDelete: (id: number) =>
      api.post(`/tenant/loans/${id}/soft_delete/`),
    restore: (id: number) =>
      api.post(`/tenant/loans/${id}/restore/`),
    history: (id: number) =>
      api.get(`/tenant/loans/${id}/history/`),
    generateSchedule: (id: number) =>
      api.post(`/tenant/loans/${id}/generate_schedule/`),
    approve: (id: number) =>
      api.post(`/tenant/loans/${id}/approve/`),
    close: (id: number) =>
      api.post(`/tenant/loans/${id}/close/`),
    markDefaulted: (id: number) =>
      api.post(`/tenant/loans/${id}/mark_defaulted/`),
    summary: (params?: Record<string, any>) =>
      api.get('/tenant/loans/summary/', { params }),
  },

  // Repayment Schedules
  repaymentSchedules: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<RepaymentSchedule>>('/tenant/repayment-schedules/', { params }),
    get: (id: number) =>
      api.get<RepaymentSchedule>(`/tenant/repayment-schedules/${id}/`),
    create: (data: Partial<RepaymentSchedule>) =>
      api.post<RepaymentSchedule>('/tenant/repayment-schedules/', data),
    update: (id: number, data: Partial<RepaymentSchedule>) =>
      api.patch<RepaymentSchedule>(`/tenant/repayment-schedules/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/tenant/repayment-schedules/${id}/`),
    recordPayment: (id: number, amount: string) =>
      api.post(`/tenant/repayment-schedules/${id}/record_payment/`, { amount }),
    overdue: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<RepaymentSchedule>>('/tenant/repayment-schedules/overdue/', { params }),
  },

  // Loan Adjustments
  loanAdjustments: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<LoanAdjustment>>('/tenant/loan-adjustments/', { params }),
    get: (id: number) =>
      api.get<LoanAdjustment>(`/tenant/loan-adjustments/${id}/`),
    create: (data: AdjustmentForm) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'supporting_document' && value instanceof File) {
            formData.append(key, value);
          } else {
            formData.append(key, String(value));
          }
        }
      });
      return api.post<LoanAdjustment>('/tenant/loan-adjustments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    update: (id: number, data: Partial<AdjustmentForm>) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'supporting_document' && value instanceof File) {
            formData.append(key, value);
          } else {
            formData.append(key, String(value));
          }
        }
      });
      return api.patch<LoanAdjustment>(`/tenant/loan-adjustments/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    delete: (id: number) =>
      api.delete(`/tenant/loan-adjustments/${id}/`),
    approve: (id: number) =>
      api.post(`/tenant/loan-adjustments/${id}/approve/`),
    reject: (id: number, reason?: string) =>
      api.post(`/tenant/loan-adjustments/${id}/reject/`, { reason }),
  },

  // Loan Documents
  loanDocuments: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<LoanDocument>>('/tenant/loan-documents/', { params }),
    get: (id: number) =>
      api.get<LoanDocument>(`/tenant/loan-documents/${id}/`),
    create: (data: DocumentForm) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'file' && value instanceof File) {
            formData.append(key, value);
          } else {
            formData.append(key, String(value));
          }
        }
      });
      return api.post<LoanDocument>('/tenant/loan-documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    delete: (id: number) =>
      api.delete(`/tenant/loan-documents/${id}/`),
  },

  // Reports
  reports: {
    portfolioSummary: (params?: Record<string, any>) =>
      api.get<TenantPortfolioSummaryResponse>(
        '/tenant/reports/portfolio_summary/',
        { params }
      ),

    monthlyTrends: (params?: Record<string, any>) =>
      api.get<MonthlyTrends>(
        '/tenant/reports/monthly_trends/',
        { params }
      ),

    generateMFIReport: (period: string) =>
      api.post<MFIReportPayload>(
        '/tenant/reports/generate_mfi_report/',
        { period }
      ),
  },

  // Audit trail -- who changed what, and when
  activity: {
    list: (params?: Record<string, any>) =>
      api.get<ActivityFeedResponse>('/tenant/activity/', { params }),
  },
};

// Cross-tenant (Public Schema) API
export const crossTenantApi = {
  mfiReports: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<any>>('/tenant/public/cross-tenant/mfi_reports/', { params }),
  },
  generateAoMReport: (aomId: number, period: string) =>
    api.post('/tenant/public/cross-tenant/generate_aom_report/', { aom_id: aomId, period }),
  generateDonorReport: (donorId: number, period: string) =>
    api.post('/tenant/public/cross-tenant/generate_donor_report/', { donor_id: donorId, period }),
  cachedReport: (type: 'mfi' | 'aom' | 'donor', entityId: number, period: string) =>
    api.get('/tenant/public/cross-tenant/cached_report/', {
      params: { type, entity_id: entityId, period }
    }),
};

export const usePortfolioSummary = (params?: Record<string, any>) =>
  useQuery({
    queryKey: ['tenant', 'reports', 'portfolio-summary', params],
    queryFn: async () =>
      (await tenantApi.reports.portfolioSummary(params))
        .data as TenantPortfolioSummaryResponse,
    staleTime: 2 * 60 * 1000,
  });
