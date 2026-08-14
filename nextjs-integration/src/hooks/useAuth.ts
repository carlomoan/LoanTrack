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
      // Set tokens FIRST so subsequent requests (like me()) have the Authorization header
      const { setTokens: clientSetTokens, setTenantSchema } = await import('@/api/client');
      clientSetTokens(response.data.access, response.data.refresh);
      
      try {
        const userResponse = await authApi.me();
        const user = userResponse.data;
        
        // Set tenant schema for this user if they have an MFI
        if (user.mfi_schema) {
          setTenantSchema(user.mfi_schema);
        } else if (user.mfi) {
          // Fallback: try to get schema from MFI ID
          setTenantSchema(`tenant_mfi${user.mfi}`);
        }
        
        setAuth(response.data, user);
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

// �������� THIS IS THE MISSING EXPORT
export function useAuthBootstrap() {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setUser = useAuthStore((state) => state.setUser);

  // Hydrate auth and set up axios client synchronously
  useEffect(() => {
    hydrateAuth();
    
    // Set tokens and tenant schema in axios client immediately after hydration
    if (accessToken && refreshToken) {
      const { setTokens: clientSetTokens, setTenantSchema, getTenantSchema } = require('@/api/client');
      clientSetTokens(accessToken, refreshToken);
      
      // Set tenant schema from user if available
      if (user?.mfi_schema) {
        setTenantSchema(user.mfi_schema);
      } else if (user?.mfi) {
        setTenantSchema(`tenant_mfi${user.mfi}`);
      } else {
        // Try to get from localStorage
        const storedSchema = getTenantSchema();
        if (storedSchema) {
          setTenantSchema(storedSchema);
        }
      }
    }
  }, [hydrateAuth]);

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
