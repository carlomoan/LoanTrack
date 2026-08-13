import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { sharedApi } from '@/api/shared';
import { crossTenantApi, tenantApi } from '@/api/tenant';
import { queryKeys } from '@/lib/query-keys';
import type {
  AoMReport,
  DonorReport,
  MFIReport,
  MonthlyTrends,
  PaginatedResponse,
  QueryParams,
  TenantPortfolioSummaryResponse,
} from '@/types';

const TWO_MINUTES = 2 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;

// =============================================================================
// Tenant Reports
// =============================================================================

export const usePortfolioSummary = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.portfolioSummary(params),
    queryFn: async () =>
      (await tenantApi.reports.portfolioSummary(params)).data as TenantPortfolioSummaryResponse,
    staleTime: TWO_MINUTES,
  });

export const useMonthlyTrends = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.monthlyTrends(params),
    queryFn: async () =>
      (await tenantApi.reports.monthlyTrends(params)).data as MonthlyTrends,
    staleTime: FIVE_MINUTES,
  });

export const useGenerateMFIReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (period: string) =>
      (await tenantApi.reports.generateMFIReport(period)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'reports'],
      });

      queryClient.invalidateQueries({
        queryKey: ['shared', 'mfi-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: ['cross-tenant'],
      });
    },
  });
};

// =============================================================================
// Shared MFI Reports
// =============================================================================

export const useMFIReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.mfiReports(params),
    queryFn: async () =>
      (await sharedApi.mfiReports.list(params)).data as PaginatedResponse<MFIReport>,
    staleTime: TWO_MINUTES,
  });

export const useMFIReport = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.mfiReport(id),
    queryFn: async () =>
      (await sharedApi.mfiReports.get(id)).data as MFIReport,
    enabled: Boolean(id),
  });

export const useSubmitMFIReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<MFIReport>(`/mfi-reports/${id}/submit/`)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'mfi-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.mfiReport(id),
      });
    },
  });
};

export const useApproveMFIReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<MFIReport>(`/mfi-reports/${id}/approve/`)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'mfi-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.mfiReport(id),
      });
    },
  });
};

export const useRejectMFIReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<MFIReport>(`/mfi-reports/${id}/reject/`)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'mfi-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.mfiReport(id),
      });
    },
  });
};

// =============================================================================
// Shared AoM Reports
// =============================================================================

export const useAoMReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.aomReports(params),
    queryFn: async () =>
      (await sharedApi.aomReports.list(params)).data as PaginatedResponse<AoMReport>,
    staleTime: TWO_MINUTES,
  });

export const useAoMReport = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.aomReport(id),
    queryFn: async () =>
      (await sharedApi.aomReports.get(id)).data as AoMReport,
    enabled: Boolean(id),
  });

export const useApproveAoMReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<AoMReport>(`/aom-reports/${id}/approve/`)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'aom-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.aomReport(id),
      });
    },
  });
};

// =============================================================================
// Shared Donor Reports
// =============================================================================

export const useDonorReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.donorReports(params),
    queryFn: async () =>
      (await sharedApi.donorReports.list(params)).data as PaginatedResponse<DonorReport>,
    staleTime: TWO_MINUTES,
  });

export const useDonorReport = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.donorReport(id),
    queryFn: async () =>
      (await sharedApi.donorReports.get(id)).data as DonorReport,
    enabled: Boolean(id),
  });

export const useApproveDonorReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<DonorReport>(`/donor-reports/${id}/approve/`)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'donor-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.donorReport(id),
      });
    },
  });
};

// =============================================================================
// Cross-Tenant Reports
// =============================================================================

export const useCrossMFIReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.crossTenant.mfiReports(params),
    queryFn: async () =>
      (await crossTenantApi.mfiReports.list(params)).data as PaginatedResponse<MFIReport>,
    staleTime: TWO_MINUTES,
  });

export const useGenerateAoMReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      aomId,
      period,
    }: {
      aomId: number;
      period: string;
    }) => (await crossTenantApi.generateAoMReport(aomId, period)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'aom-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: ['cross-tenant'],
      });
    },
  });
};

export const useGenerateDonorReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      donorId,
      period,
    }: {
      donorId: number;
      period: string;
    }) => (await crossTenantApi.generateDonorReport(donorId, period)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'donor-reports'],
      });

      queryClient.invalidateQueries({
        queryKey: ['cross-tenant'],
      });
    },
  });
};

export const useCachedReport = (
  type: 'mfi' | 'aom' | 'donor',
  entityId: number,
  period: string
) =>
  useQuery({
    queryKey: queryKeys.crossTenant.cachedReport(type, entityId, period),
    queryFn: async () =>
      (await crossTenantApi.cachedReport(type, entityId, period)).data as {
        cached: boolean;
        data: MFIReport | AoMReport | DonorReport | null;
      },
    enabled: Boolean(entityId) && Boolean(period),
    staleTime: FIVE_MINUTES,
  });
