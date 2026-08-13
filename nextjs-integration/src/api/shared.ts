import api from '@/api/client';
import type {
  MFI, Donor, AoM, GlobalUser, ExchangeRate,
  MFIReport, AoMReport, DonorReport, PaginatedResponse,
  MFIForm, ExchangeRateForm,
  Domain, // <--- ADD THIS
} from '@/types';

// Shared/Public Schema API
export const sharedApi = {
  // Donors
  donors: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Donor>>('/donors/', { params }),
    get: (id: number) =>
      api.get<Donor>(`/donors/${id}/`),
    create: (data: Partial<Donor>) =>
      api.post<Donor>('/donors/', data),
    update: (id: number, data: Partial<Donor>) =>
      api.patch<Donor>(`/donors/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/donors/${id}/`),
  },

  // AoMs
  aoms: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<AoM>>('/aoms/', { params }),
    get: (id: number) =>
      api.get<AoM>(`/aoms/${id}/`),
    create: (data: Partial<AoM>) =>
      api.post<AoM>('/aoms/', data),
    update: (id: number, data: Partial<AoM>) =>
      api.patch<AoM>(`/aoms/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/aoms/${id}/`),
  },

  // MFIs
  mfis: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<MFI>>('/mfis/', { params }),
    get: (id: number) =>
      api.get<MFI>(`/mfis/${id}/`),
    create: (data: MFIForm) =>
      api.post<MFI>('/mfis/', data),
    update: (id: number, data: Partial<MFIForm>) =>
      api.patch<MFI>(`/mfis/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/mfis/${id}/`),
    createSchema: (id: number) =>
      api.post(`/mfis/${id}/create_schema/`),
    schemaInfo: (id: number) =>
      api.get(`/mfis/${id}/schema_info/`),
  },

  // Domains
  domains: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<Domain>>('/domains/', { params }),
    get: (id: number) =>
      api.get<Domain>(`/domains/${id}/`),
    create: (data: { domain: string; tenant: number; is_primary?: boolean }) =>
      api.post<Domain>('/domains/', data),
    update: (id: number, data: Partial<Domain>) =>
      api.patch<Domain>(`/domains/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/domains/${id}/`),
  },

  // Users
  users: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<GlobalUser>>('/users/', { params }),
    get: (id: number) =>
      api.get<GlobalUser>(`/users/${id}/`),
    create: (data: Partial<GlobalUser> & { password: string }) =>
      api.post<GlobalUser>('/users/', data),
    update: (id: number, data: Partial<GlobalUser>) =>
      api.patch<GlobalUser>(`/users/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/users/${id}/`),
    me: () =>
      api.get<GlobalUser>('/users/me/'),
  },

  // Exchange Rates
  exchangeRates: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<ExchangeRate>>('/exchange-rates/', { params }),
    get: (id: number) =>
      api.get<ExchangeRate>(`/exchange-rates/${id}/`),
    create: (data: ExchangeRateForm) =>
      api.post<ExchangeRate>('/exchange-rates/', data),
    update: (id: number, data: Partial<ExchangeRateForm>) =>
      api.patch<ExchangeRate>(`/exchange-rates/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/exchange-rates/${id}/`),
  },

  // MFI Reports
  mfiReports: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<MFIReport>>('/mfi-reports/', { params }),
    get: (id: number) =>
      api.get<MFIReport>(`/mfi-reports/${id}/`),
    create: (data: Partial<MFIReport>) =>
      api.post<MFIReport>('/mfi-reports/', data),
    update: (id: number, data: Partial<MFIReport>) =>
      api.patch<MFIReport>(`/mfi-reports/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/mfi-reports/${id}/`),
  },

  // AoM Reports
  aomReports: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<AoMReport>>('/aom-reports/', { params }),
    get: (id: number) =>
      api.get<AoMReport>(`/aom-reports/${id}/`),
    create: (data: Partial<AoMReport>) =>
      api.post<AoMReport>('/aom-reports/', data),
    update: (id: number, data: Partial<AoMReport>) =>
      api.patch<AoMReport>(`/aom-reports/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/aom-reports/${id}/`),
  },

  // Donor Reports
  donorReports: {
    list: (params?: Record<string, any>) =>
      api.get<PaginatedResponse<DonorReport>>('/donor-reports/', { params }),
    get: (id: number) =>
      api.get<DonorReport>(`/donor-reports/${id}/`),
    create: (data: Partial<DonorReport>) =>
      api.post<DonorReport>('/donor-reports/', data),
    update: (id: number, data: Partial<DonorReport>) =>
      api.patch<DonorReport>(`/donor-reports/${id}/`, data),
    delete: (id: number) =>
      api.delete(`/donor-reports/${id}/`),
  },
};
