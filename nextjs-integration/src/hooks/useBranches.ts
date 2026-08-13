// src/hooks/useBranches.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import type { Branch, PaginatedResponse, QueryParams } from '@/types';

export const useBranches = (params?: QueryParams) =>
  useQuery({
    queryKey: ['tenant', 'branches', params],
    queryFn: async () =>
      // ✅ Removed Promise<> wrapper
      (await tenantApi.branches.list(params)).data as PaginatedResponse<Branch>,
    staleTime: 5 * 60 * 1000,
  });

export const useBranch = (id: number) =>
  useQuery({
    queryKey: ['tenant', 'branch', id],
    queryFn: async () =>
      // ✅ Removed Promise<> wrapper
      (await tenantApi.branches.get(id)).data as Branch,
    enabled: !!id,
  });

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Branch>) =>
      tenantApi.branches.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Branch> }) =>
      tenantApi.branches.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tenantApi.branches.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', 'branches'] });
    },
  });
};
