// src/hooks/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearTokens, setTokens } from '@/api/client';
import { useTenantContext } from '@/hooks/useTenantContext';
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
        set({
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        clearTokens();
        useTenantContext.getState().clearSelectedMfi();
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
          if (access) {
            set({ isAuthenticated: true, accessToken: access });
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
