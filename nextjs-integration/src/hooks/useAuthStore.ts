// src/hooks/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearTokens, setTokens, setTenantSchema, clearTenantSchema, getTenantSchema } from '@/api/client';
import type { GlobalUser, TokenResponse } from '@/types';

interface AuthState {
  user: GlobalUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (tokens: TokenResponse, user: GlobalUser) => void;
  setUser: (user: GlobalUser) => void;
  logout: () => void;
  hydrateAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (tokens, user) => {
        setTokens(tokens.access, tokens.refresh);
        // Set tenant schema from user's MFI
        if (user.mfi_schema) {
          setTenantSchema(user.mfi_schema);
        } else if (user.mfi) {
          setTenantSchema(`tenant_mfi${user.mfi}`);
        }
        set({
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setUser: (user) => {
        if (user.mfi_schema) {
          setTenantSchema(user.mfi_schema);
        } else if (user.mfi) {
          setTenantSchema(`tenant_mfi${user.mfi}`);
        }
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        clearTokens();
        clearTenantSchema();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      hydrateAuth: () => {
        if (typeof window !== 'undefined') {
          const access = localStorage.getItem('access_token');
          const refresh = localStorage.getItem('refresh_token');
          const tenantSchema = localStorage.getItem('tenant_schema');
          if (access) {
            set({ isAuthenticated: true, accessToken: access, refreshToken: refresh });
            if (tenantSchema) {
              setTenantSchema(tenantSchema);
            }
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);