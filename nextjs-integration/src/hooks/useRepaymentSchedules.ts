// src/hooks/useRepaymentSchedules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import type { RepaymentSchedule, PaginatedResponse, QueryParams } from '@/types';

export const useRepaymentSchedules = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'repaymentSchedules', params],
    queryFn: async () =>
      (await tenantApi.repaymentSchedules.list(params)).data as PaginatedResponse<RepaymentSchedule>,
    staleTime: 1 * 60 * 1000,
  });

export const useRepaymentSchedule = (id: number) =>
  useQuery({
    queryKey: ['tenant', 'repaymentSchedule', id],
    queryFn: async () =>
      (await tenantApi.repaymentSchedules.get(id)).data as RepaymentSchedule,
    enabled: !!id,
  });

export const useOverdueSchedules = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'repaymentSchedules', 'overdue', params],
    queryFn: async () =>
      (await tenantApi.repaymentSchedules.overdue(params)).data as PaginatedResponse<RepaymentSchedule>,
    staleTime: 30 * 1000,
  });

export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      tenantApi.repaymentSchedules.recordPayment(id, amount).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'repaymentSchedules'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans', 'summary'] });
    },
  });
};
