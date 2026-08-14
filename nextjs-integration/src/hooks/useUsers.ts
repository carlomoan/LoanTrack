// src/hooks/useUsers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sharedApi } from '@/api/shared';
import { queryKeys } from '@/lib/query-keys';
import type { GlobalUser, PaginatedResponse, QueryParams } from '@/types';

export const useUsers = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.shared.users(params),
    queryFn: async () =>
      (await sharedApi.users.list(params)).data as PaginatedResponse<GlobalUser>,
    staleTime: 2 * 60 * 1000,
  });

export const useUser = (id: number) =>
  useQuery({
    queryKey: queryKeys.shared.user(id),
    queryFn: async () =>
      (await sharedApi.users.get(id)).data as GlobalUser,
    enabled: Boolean(id),
  });

export const useUserRoles = () =>
  useQuery({
    queryKey: ['shared', 'users', 'roles'],
    queryFn: async () =>
      (await sharedApi.users.roles()).data as { value: string; label: string }[],
    staleTime: 10 * 60 * 1000,
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<GlobalUser> & { password: string }) =>
      (await sharedApi.users.create(data)).data as GlobalUser,

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
    }) => (await sharedApi.users.update(id, data)).data as GlobalUser,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.shared.user(variables.id) });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) =>
      (await sharedApi.users.delete(id)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared', 'users'] });
    },
  });
};