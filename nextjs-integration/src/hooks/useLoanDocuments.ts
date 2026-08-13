// src/hooks/useLoanDocuments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import type { LoanDocument, DocumentForm, PaginatedResponse, QueryParams } from '@/types';

export const useLoanDocuments = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'loanDocuments', params],
    queryFn: async () =>
      (await tenantApi.loanDocuments.list(params)).data as PaginatedResponse<LoanDocument>,
    staleTime: 5 * 60 * 1000,
  });

export const useLoanDocument = (id: number) =>
  useQuery({
    queryKey: ['tenant', 'loanDocument', id],
    queryFn: async () =>
      (await tenantApi.loanDocuments.get(id)).data as LoanDocument,
    enabled: !!id,
  });

export const useUploadLoanDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DocumentForm) =>
      tenantApi.loanDocuments.create(data).then(res => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanDocuments'] });
      // Also invalidate the specific loan so its document list updates
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loan', variables.loan] });
    },
  });
};

export const useDeleteLoanDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tenantApi.loanDocuments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loanDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'loans'] });
    },
  });
};
