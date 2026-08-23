import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { sharedApi } from '@/api/shared';
import { queryKeys } from '@/lib/query-keys';
import type {
  AoM,
  Donor,
  DonorContribution,
  Domain,
  ExchangeRate,
  ExchangeRateForm,
  GlobalUser,
  MFI,
  MFIDisbursement,
  MFIDisbursementRepayment,
  MFIForm,
  MFIReport,
  AoMReport,
  DonorReport,
  QueryParams,
} from '@/types';

const FIVE_MINUTES = 5 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

// =============================================================================
// Donors
// =============================================================================

export const useDonors = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.donors(params),
    queryFn: async () => (await sharedApi.donors.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useDonor = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.donor(id),
    queryFn: async () => (await sharedApi.donors.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateDonor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Donor>) =>
      (await sharedApi.donors.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'donors'] });
    },
  });
};

export const useUpdateDonor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Donor> }) =>
      (await sharedApi.donors.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'donors'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.donor(variables.id),
      });
    },
  });
};

export const useDeleteDonor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => (await sharedApi.donors.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'donors'] });
    },
  });
};

// =============================================================================
// AoMs
// =============================================================================

export const useAoMs = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.aoms(params),
    queryFn: async () => (await sharedApi.aoms.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useAoM = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.aom(id),
    queryFn: async () => (await sharedApi.aoms.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateAoM = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<AoM>) =>
      (await sharedApi.aoms.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'aoms'] });
    },
  });
};

export const useUpdateAoM = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AoM> }) =>
      (await sharedApi.aoms.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'aoms'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.aom(variables.id),
      });
    },
  });
};

export const useDeleteAoM = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => (await sharedApi.aoms.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'aoms'] });
    },
  });
};

// =============================================================================
// MFIs
// =============================================================================

export const useMFIs = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.mfis(params),
    queryFn: async () => (await sharedApi.mfis.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useMFI = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.mfi(id),
    queryFn: async () => (await sharedApi.mfis.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateMFI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MFIForm) =>
      (await sharedApi.mfis.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfis'] });
    },
  });
};

export const useUpdateMFI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MFIForm> }) =>
      (await sharedApi.mfis.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfis'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.mfi(variables.id),
      });
    },
  });
};

export const useDeleteMFI = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => (await sharedApi.mfis.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfis'] });
    },
  });
};

export const useCreateMFISchema = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await sharedApi.mfis.createSchema(id)).data,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfis'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.mfiSchemaInfo(id),
      });
    },
  });
};

export const useMFISchemaInfo = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.mfiSchemaInfo(id),
    queryFn: async () => (await sharedApi.mfis.schemaInfo(id)).data,
    enabled: Boolean(id),
    staleTime: FIVE_MINUTES,
  });

// =============================================================================
// Domains
// =============================================================================

export const useDomains = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.domains(params),
    queryFn: async () => (await sharedApi.domains.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useCreateDomain = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      domain: string;
      tenant: number;
      is_primary?: boolean;
    }) => (await sharedApi.domains.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'domains'] });
    },
  });
};

export const useUpdateDomain = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Domain> }) =>
      (await sharedApi.domains.update(id, data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'domains'] });
    },
  });
};

export const useDeleteDomain = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => (await sharedApi.domains.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'domains'] });
    },
  });
};

// =============================================================================
// Users
// =============================================================================

export const useUsers = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.users(params),
    queryFn: async () => (await sharedApi.users.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useUser = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.user(id),
    queryFn: async () => (await sharedApi.users.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Partial<GlobalUser> & { password: string }
    ) => (await sharedApi.users.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'users'] });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<GlobalUser>;
    }) => (await sharedApi.users.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'users'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shared.user(variables.id),
      });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => sharedApi.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'users'] });
    },
  });
};

// =============================================================================
// Exchange Rates
// =============================================================================

export const useExchangeRates = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.exchangeRates(params),
    queryFn: async () => (await sharedApi.exchangeRates.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useCreateExchangeRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ExchangeRateForm) =>
      (await sharedApi.exchangeRates.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'exchange-rates'],
      });
    },
  });
};

export const useUpdateExchangeRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<ExchangeRateForm>;
    }) => (await sharedApi.exchangeRates.update(id, data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['shared', 'exchange-rates'],
      });
    },
  });
};

// =============================================================================
// Shared Reports
// =============================================================================

export const useSharedMFIReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.mfiReports(params),
    queryFn: async () => (await sharedApi.mfiReports.list(params)).data,
    staleTime: 2 * 60 * 1000,
  });

export const useSharedAoMReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.aomReports(params),
    queryFn: async () => (await sharedApi.aomReports.list(params)).data,
    staleTime: 2 * 60 * 1000,
  });

export const useSharedDonorReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.donorReports(params),
    queryFn: async () => (await sharedApi.donorReports.list(params)).data,
    staleTime: 2 * 60 * 1000,
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
// Fund flow: Donor -> AoM -> MFI
// =============================================================================

export const useDonorContributions = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.donorContributions(params),
    queryFn: async () => (await sharedApi.donorContributions.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useCreateDonorContribution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DonorContribution>) =>
      sharedApi.donorContributions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'donor-contributions'] });
    },
  });
};

export const useMFIDisbursements = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.mfiDisbursements(params),
    queryFn: async () => (await sharedApi.mfiDisbursements.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useMFIDisbursement = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.mfiDisbursement(id),
    queryFn: async () => (await sharedApi.mfiDisbursements.get(id)).data,
    enabled: !!id,
  });

export const useCreateMFIDisbursement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MFIDisbursement>) =>
      sharedApi.mfiDisbursements.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfi-disbursements'] });
    },
  });
};

export const useGenerateDisbursementSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sharedApi.mfiDisbursements.generateSchedule(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfi-disbursements'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.shared.mfiDisbursement(id) });
    },
  });
};

export const useDisbursementRepayments = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.disbursementRepayments(params),
    queryFn: async () => (await sharedApi.disbursementRepayments.list(params)).data,
    enabled: !!params?.disbursement,
  });

export const useRecordDisbursementPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      sharedApi.disbursementRepayments.recordPayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'disbursement-repayments'] });
      queryClient.invalidateQueries({ queryKey: ['shared', 'mfi-disbursements'] });
    },
  });
};

// =============================================================================
// Notifications
// =============================================================================

export const useNotifications = () =>
  useQuery({
    queryKey: ['shared', 'notifications'],
    queryFn: async () => (await sharedApi.notifications.summary()).data,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // real polling, not a one-time fetch on mount
  });
