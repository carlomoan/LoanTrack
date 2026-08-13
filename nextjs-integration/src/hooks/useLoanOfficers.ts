// src/hooks/useLoanOfficers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import type { LoanOfficer, PaginatedResponse, QueryParams } from '@/types';

export const useLoanOfficers = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'loanOfficers', params],
    queryFn: async () =>
      (await tenantApi.loanOfficers.list(params)).data as PaginatedResponse<LoanOfficer>,
    staleTime: 5 * 60 * 1000,
  });

export const useLoanOfficer = (id: number) =>
  useQuery({
    queryKey: ['tenant', 'loanOfficer', id],
    queryFn: async () =>
      (await tenantApi.loanOfficers.get(id)).data as LoanOfficer,
    enabled: !!id,
  });

export const useCreateLoanOfficer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<LoanOfficer>) =>
      tenantApi.loanOfficers.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanOfficers'] });
    },
  });
};

export const useUpdateLoanOfficer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LoanOfficer> }) =>
      tenantApi.loanOfficers.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanOfficers'] });
    },
  });
};

export const useDeleteLoanOfficer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tenantApi.loanOfficers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanOfficers'] });
    },
  });
};
