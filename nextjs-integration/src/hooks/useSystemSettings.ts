// src/hooks/useSystemSettings.ts
//
// Exposes the system-wide default currency (TZS unless an admin changes it)
// so every money-formatting call site reads the same value. The value is
// cached in localStorage too, so the very first paint after a reload uses
// the last-known currency instead of flashing USD before the fetch lands.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sharedApi } from '@/api/shared';
import { DEFAULT_CURRENCY } from '@/utils/helpers';

const CACHE_KEY = 'default_currency';

export function useDefaultCurrency(): string {
  const { data } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await sharedApi.systemSettings.get();
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, res.data.default_currency);
      }
      return res.data.default_currency as string;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // Synchronous fallback chain: fetched value -> last cached -> TZS.
  if (data) return data;
  if (typeof window !== 'undefined') {
    return localStorage.getItem(CACHE_KEY) || DEFAULT_CURRENCY;
  }
  return DEFAULT_CURRENCY;
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { default_currency?: string }) =>
      (await sharedApi.systemSettings.update(data)).data,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      // Every money-formatting call site reads the currency through this
      // hook's cache, so a change here must refresh them all.
      queryClient.invalidateQueries();
    },
  });
}