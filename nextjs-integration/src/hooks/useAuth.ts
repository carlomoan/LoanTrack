// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api, { setTokens } from '@/api/client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { GlobalUser, LoginForm, TokenResponse } from '@/types';

export const authApi = {
  login: (data: LoginForm) => api.post<TokenResponse>('/token/', data),
  me: () => api.get<GlobalUser>('/users/me/'),
  logout: async () => Promise.resolve(),
};

export function useLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response) => {
      // Store the token BEFORE fetching the profile. setAuth() also
      // stores it, but only after the profile fetch below returns --
      // too late, since that fetch needs the Authorization header itself.
      // Without this, /users/me/ goes out with no token at all and 401s.
      setTokens(response.data.access, response.data.refresh);

      // Fetching the profile is not optional: it's what tells the app
      // this user's role and which MFI they belong to, which in turn
      // decides the X-Tenant-Subdomain header on every request they make
      // from here on (see api/client.ts resolveTenantSubdomain). A user
      // logged in without a real profile would either get silently
      // routed to the wrong tenant or hit a wall of 403s with no way to
      // tell why -- so if this fails, the login itself has failed, not
      // just degraded.
      const userResponse = await authApi.me();
      setAuth(response.data, userResponse.data);
    },
    onError: () => {
      logout();
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
  const logout = useAuthStore((state) => state.logout);

  const query = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => (await authApi.me()).data,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  useEffect(() => {
    // The access token was accepted but the profile fetch still failed
    // (e.g. the account was deactivated, or the token is stale) -- don't
    // leave the app sitting on isAuthenticated: true with no real user.
    if (query.isError) logout();
  }, [query.isError, logout]);

  return query;
}

export function useAuthBootstrap() {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const query = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: async () => (await authApi.me()).data,
    enabled: isAuthenticated && !user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  useEffect(() => {
    if (query.isError) logout();
  }, [query.isError, logout]);

  return query;
}
