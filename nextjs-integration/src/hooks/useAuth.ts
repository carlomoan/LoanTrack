// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { GlobalUser, LoginForm, TokenResponse } from '@/types';

const FALLBACK_USER: Omit<GlobalUser, 'username'> = {
  id: 0,
  email: '',
  first_name: '',
  last_name: '',
  role: 'MFI_MANAGER',
  aom: null,
  donor: null,
  mfi: null,
  branch: null,
  is_staff: false,
  is_active: true,
  date_joined: new Date().toISOString(),
  last_login: new Date().toISOString(),
};

export const authApi = {
  login: (data: LoginForm) => api.post<TokenResponse>('/token/', data),
  me: () => api.get<GlobalUser>('/users/me/'),
  logout: async () => Promise.resolve(),
};

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response, variables) => {
      try {
        const userResponse = await authApi.me();
        setAuth(response.data, userResponse.data);
      } catch {
        setAuth(response.data, {
          ...FALLBACK_USER,
          username: variables.username,
        } as GlobalUser);
      }
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((state) => state.logout);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => logout(),
  });
}

export function useUserProfile() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => (await authApi.me()).data,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}

// ✅ THIS IS THE MISSING EXPORT
export function useAuthBootstrap() {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => { hydrateAuth(); }, [hydrateAuth]);

  const query = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => (await authApi.me()).data,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
