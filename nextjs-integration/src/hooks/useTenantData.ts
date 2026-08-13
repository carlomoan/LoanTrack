import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crossTenantApi, tenantApi } from '@/api/tenant';
import { queryKeys } from '@/lib/query-keys';
import type {
  AdjustmentForm,
  Branch,
  District,
  DocumentForm,
  Loan,
  LoanAdjustment,
  LoanDocument,
  LoanForm,
  LoanOfficer,
  Member,
  MemberForm,
  MonthlyTrends,
  PortfolioSummary,
  QueryParams,
  Region,
  RepaymentSchedule,
  Street,
  Ward,
} from '@/types';

const ONE_MINUTE = 60 * 1000;
const TWO_MINUTES = 2 * 60 * 1000;
const FIVE_MINUTES = 5 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

// =============================================================================
// Geography
// =============================================================================

export const useRegions = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.regions(params),
    queryFn: async () => (await tenantApi.regions.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useDistricts = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.districts(params),
    queryFn: async () => (await tenantApi.districts.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useWards = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.wards(params),
    queryFn: async () => (await tenantApi.wards.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useStreets = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.streets(params),
    queryFn: async () => (await tenantApi.streets.list(params)).data,
    staleTime: TEN_MINUTES,
  });

export const useCreateRegion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Region>) =>
      (await tenantApi.regions.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'regions'] });
    },
  });
};

export const useCreateDistrict = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<District>) =>
      (await tenantApi.districts.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'districts'] });
    },
  });
};

export const useCreateWard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Ward>) =>
      (await tenantApi.wards.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'wards'] });
    },
  });
};

export const useCreateStreet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Street>) =>
      (await tenantApi.streets.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'streets'] });
    },
  });
};

// =============================================================================
// Branches
// =============================================================================

export const useBranches = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.branches(params),
    queryFn: async () => (await tenantApi.branches.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useBranch = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.branch(id),
    queryFn: async () => (await tenantApi.branches.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Branch>) =>
      (await tenantApi.branches.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Branch> }) =>
      (await tenantApi.branches.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.branch(variables.id),
      });
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.branches.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
    },
  });
};

// =============================================================================
// Loan Officers
// =============================================================================

export const useLoanOfficers = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.loanOfficers(params),
    queryFn: async () => (await tenantApi.loanOfficers.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useLoanOfficer = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.loanOfficer(id),
    queryFn: async () => (await tenantApi.loanOfficers.get(id)).data,
    enabled: Boolean(id),
  });

export const useCreateLoanOfficer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LoanOfficer>) =>
      (await tenantApi.loanOfficers.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loan-officers'] });
    },
  });
};

export const useUpdateLoanOfficer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<LoanOfficer>;
    }) => (await tenantApi.loanOfficers.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loan-officers'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.loanOfficer(variables.id),
      });
    },
  });
};

export const useDeleteLoanOfficer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loanOfficers.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loan-officers'] });
    },
  });
};

// =============================================================================
// Members
// =============================================================================

export const useMembers = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.members(params),
    queryFn: async () => (await tenantApi.members.list(params)).data,
    staleTime: TWO_MINUTES,
  });

export const useMember = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.member(id),
    queryFn: async () => (await tenantApi.members.get(id)).data,
    enabled: Boolean(id),
  });

export const useMemberLoans = (memberId: number) =>
  useQuery({
    queryKey: queryKeys.tenant.memberLoans(memberId),
    queryFn: async () => (await tenantApi.members.getLoans(memberId)).data,
    enabled: Boolean(memberId),
  });

export const useCreateMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemberForm) =>
      (await tenantApi.members.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<MemberForm>;
    }) => (await tenantApi.members.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.member(variables.id),
      });
    },
  });
};

export const useDeleteMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.members.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'members'] });
    },
  });
};

// =============================================================================
// Loans
// =============================================================================

export const useLoans = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.loans(params),
    queryFn: async () => (await tenantApi.loans.list(params)).data,
    staleTime: ONE_MINUTE,
  });

export const useLoan = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.loan(id),
    queryFn: async () => (await tenantApi.loans.get(id)).data,
    enabled: Boolean(id),
  });

export const useLoanSummary = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.loanSummary(params),
    queryFn: async () => (await tenantApi.loans.summary(params)).data,
    staleTime: ONE_MINUTE,
  });

export const useCreateLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoanForm) =>
      (await tenantApi.loans.create(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });
    },
  });
};

export const useUpdateLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<LoanForm>;
    }) => (await tenantApi.loans.update(id, data)).data,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.loan(variables.id),
      });
    },
  });
};

export const useSoftDeleteLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loans.softDelete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });
    },
  });
};

export const useRestoreLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loans.restore(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });
    },
  });
};

export const useLoanHistory = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.loanHistory(id),
    queryFn: async () => (await tenantApi.loans.history(id)).data,
    enabled: Boolean(id),
  });

export const useGenerateLoanSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loanId: number) =>
      (await tenantApi.loans.generateSchedule(loanId)).data,

    onSuccess: (_data, loanId) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'repayment-schedules'],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.loan(loanId),
      });
    },
  });
};

// =============================================================================
// Repayment Schedules
// =============================================================================

export const useRepaymentSchedules = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.repaymentSchedules(params),
    queryFn: async () =>
      (await tenantApi.repaymentSchedules.list(params)).data,
    staleTime: ONE_MINUTE,
  });

export const useOverdueSchedules = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.overdueSchedules(params),
    queryFn: async () =>
      (await tenantApi.repaymentSchedules.overdue(params)).data,
    staleTime: 30 * 1000,
  });

export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: string }) =>
      (await tenantApi.repaymentSchedules.recordPayment(id, amount)).data,

    onSuccess: (schedule: RepaymentSchedule) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'repayment-schedules'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'repayment-schedules', 'overdue'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });

      if (schedule?.loan) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.loan(schedule.loan),
        });
      }
    },
  });
};

// =============================================================================
// Loan Adjustments
// =============================================================================

export const useLoanAdjustments = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.loanAdjustments(params),
    queryFn: async () => (await tenantApi.loanAdjustments.list(params)).data,
    staleTime: TWO_MINUTES,
  });

export const useCreateLoanAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdjustmentForm) =>
      (await tenantApi.loanAdjustments.create(data)).data,

    onSuccess: (adjustment: LoanAdjustment) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loan-adjustments'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });

      if (adjustment?.loan) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.loan(adjustment.loan),
        });
      }
    },
  });
};

export const useApproveLoanAdjustment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loanAdjustments.approve(id)).data,

    onSuccess: (adjustment: LoanAdjustment) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loan-adjustments'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans'],
      });

      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loans', 'summary'],
      });

      if (adjustment?.loan) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.loan(adjustment.loan),
        });
      }
    },
  });
};

// =============================================================================
// Loan Documents
// =============================================================================

export const useLoanDocuments = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.loanDocuments(params),
    queryFn: async () => (await tenantApi.loanDocuments.list(params)).data,
    staleTime: FIVE_MINUTES,
  });

export const useUploadLoanDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DocumentForm) =>
      (await tenantApi.loanDocuments.create(data)).data,

    onSuccess: (document: LoanDocument) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loan-documents'],
      });

      if (document?.loan) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant.loan(document.loan),
        });
      }
    },
  });
};

export const useDeleteLoanDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loanDocuments.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'loan-documents'],
      });
    },
  });
};

// =============================================================================
// Tenant Reports
// =============================================================================

export const usePortfolioSummary = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.portfolioSummary(params),
    queryFn: async () =>
      (await tenantApi.reports.portfolioSummary(params)).data.portfolio,
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
    },
  });
};

// =============================================================================
// Cross-Tenant Reports
// =============================================================================

export const useCrossMFIReports = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.crossTenant.mfiReports(params),
    queryFn: async () => (await crossTenantApi.mfiReports.list(params)).data,
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
      (await crossTenantApi.cachedReport(type, entityId, period)).data,
    enabled: Boolean(entityId) && Boolean(period),
    staleTime: FIVE_MINUTES,
  });
