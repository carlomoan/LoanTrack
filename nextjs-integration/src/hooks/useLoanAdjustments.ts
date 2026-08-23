// src/hooks/useLoanAdjustments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import type { LoanAdjustment, AdjustmentForm, PaginatedResponse, QueryParams } from '@/types';

export const useLoanAdjustments = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'loanAdjustments', params],
    queryFn: async () =>
      (await tenantApi.loanAdjustments.list(params)).data as PaginatedResponse<LoanAdjustment>,
    staleTime: 2 * 60 * 1000,
  });

export const useLoanAdjustment = (id: number) =>
  useQuery({
    queryKey: ['tenant', 'loanAdjustment', id],
    queryFn: async () =>
      (await tenantApi.loanAdjustments.get(id)).data as LoanAdjustment,
    enabled: !!id,
  });

export const useCreateLoanAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdjustmentForm) =>
      tenantApi.loanAdjustments.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
    },
  });
};

export const useApproveLoanAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tenantApi.loanAdjustments.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
    },
  });
};

export const useRejectLoanAdjustment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      tenantApi.loanAdjustments.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
    },
  });
};
