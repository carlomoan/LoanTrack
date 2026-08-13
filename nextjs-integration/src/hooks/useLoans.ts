// src/hooks/useLoans.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import { queryKeys } from '@/lib/query-keys';
import type { Loan, LoanForm, PaginatedResponse } from '@/types';

const ONE_MINUTE = 60 * 1000;

export const useLoans = (params?: Record<string, any>) =>
  useQuery({
    queryKey: queryKeys.tenant.loans(params),
    queryFn: async () =>
      (await tenantApi.loans.list(params)).data as PaginatedResponse<Loan>,
    staleTime: ONE_MINUTE,
  });

export const useLoan = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.loan(id),
    queryFn: async () =>
      (await tenantApi.loans.get(id)).data as Loan,
    enabled: !!id,
    staleTime: ONE_MINUTE,
  });

export const useLoanSummary = (params?: Record<string, any>) =>
  useQuery({
    queryKey: queryKeys.tenant.loanSummary(params),
    queryFn: async () =>
      (await tenantApi.loans.summary(params)).data as Record<string, any>,
    staleTime: ONE_MINUTE,
  });

export const useLoanHistory = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.loanHistory(id),
    queryFn: async () =>
      (await tenantApi.loans.history(id)).data as Array<Record<string, any>>,
    enabled: !!id,
    staleTime: ONE_MINUTE,
  });

export const useCreateLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoanForm) =>
      (await tenantApi.loans.create(data)).data as Loan,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
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
    }) => (await tenantApi.loans.update(id, data)).data as Loan,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.loan(variables.id),
      });
    },
  });
};

export const useDeleteLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await tenantApi.loans.delete(id);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
    },
  });
};

export const useSoftDeleteLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loans.softDelete(id)).data as Record<string, any>,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
    },
  });
};

export const useRestoreLoan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await tenantApi.loans.restore(id)).data as Record<string, any>,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
    },
  });
};

export const useGenerateLoanSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loanId: number) =>
      (await tenantApi.loans.generateSchedule(loanId)).data as Record<string, any>,

    onSuccess: (_data, loanId) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'repaymentSchedules'],
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.loan(loanId),
      });
    },
  });
};
