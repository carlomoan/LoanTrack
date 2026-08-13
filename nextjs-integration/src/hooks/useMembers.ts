import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant';
import { queryKeys } from '@/lib/query-keys';
import type {
  Loan,
  Member,
  MemberForm,
  PaginatedResponse,
  QueryParams,
} from '@/types';

const TWO_MINUTES = 2 * 60 * 1000;

// =============================================================================
// Member Queries
// =============================================================================

export const useMembers = (params?: QueryParams) =>
  useQuery({
    queryKey: queryKeys.tenant.members(params),
    queryFn: async () =>
      (await tenantApi.members.list(params)).data as PaginatedResponse<Member>,
    staleTime: TWO_MINUTES,
  });

export const useMember = (id: number) =>
  useQuery({
    queryKey: queryKeys.tenant.member(id),
    queryFn: async () =>
      (await tenantApi.members.get(id)).data as Member,
    enabled: Boolean(id),
  });

export const useMemberLoans = (memberId: number) =>
  useQuery({
    queryKey: queryKeys.tenant.memberLoans(memberId),
    queryFn: async () =>
      (await tenantApi.members.getLoans(memberId)).data as Loan[],
    enabled: Boolean(memberId),
  });

// =============================================================================
// Member Mutations
// =============================================================================

export const useCreateMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MemberForm) =>
      (await tenantApi.members.create(data)).data as Member,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
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
    }) => (await tenantApi.members.update(id, data)).data as Member,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });

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
      queryClient.invalidateQueries({
        queryKey: ['tenant', 'members'],
      });
    },
  });
};
