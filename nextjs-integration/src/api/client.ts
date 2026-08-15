import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse, ApiError } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Explicit override for single-tenant / preview deployments. Leave unset
// for normal multi-tenant use -- the tenant is resolved per request from
// whichever MFI the logged-in user actually belongs to (see
// resolveTenantSubdomain below), never guessed or hardcoded.
const TENANT_SUBDOMAIN_OVERRIDE = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN || '';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// =============================================================================
// Token storage
// =============================================================================
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }
};

export const getAccessToken = (): string | null => {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') return localStorage.getItem('access_token');
  return null;
};

export const getRefreshToken = (): string | null => {
  if (refreshToken) return refreshToken;
  if (typeof window !== 'undefined') return localStorage.getItem('refresh_token');
  return null;
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

// =============================================================================
// Tenant resolution
// =============================================================================
// Read directly from localStorage rather than importing useAuthStore here,
// since useAuthStore itself imports setTokens/clearTokens from this file --
// importing the store back into client.ts would be a circular dependency.
const getStoredUserMfiSchema = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.mfi_schema ?? null;
  } catch {
    return null;
  }
};

// Read directly from localStorage for the same reason as above --
// useTenantContext lives in its own file so this stays a one-way
// dependency (client.ts never imports a hook/store module).
const getSelectedTenantSchema = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('tenant-context-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.selectedMfi?.schema_name ?? null;
  } catch {
    return null;
  }
};

const resolveTenantSubdomain = (): string => {
  if (TENANT_SUBDOMAIN_OVERRIDE) return TENANT_SUBDOMAIN_OVERRIDE;

  // The logged-in user's own MFI is the source of truth. Every MFI-role
  // account (MFI_ADMIN / MFI_MANAGER / LOAN_OFFICER) has exactly one MFI,
  // and the backend now rejects tenant requests where these don't match
  // -- so guessing a tenant from the hostname is both unnecessary and,
  // for a logged-in user, actively wrong if it doesn't match their MFI.
  const userMfiSchema = getStoredUserMfiSchema();
  if (userMfiSchema) return userMfiSchema;

  // Global-scope roles (SUPER_ADMIN / AOM_STAFF / DONOR_STAFF) have no
  // fixed MFI of their own -- they explicitly choose one to drill into
  // via the tenant switcher (useTenantContext). Honor that choice for
  // every request until they switch or leave that context.
  const selectedTenantSchema = getSelectedTenantSchema();
  if (selectedTenantSchema) return selectedTenantSchema;

  // Not logged in yet, or no tenant selected. Fall back to a subdomain
  // parsed from the hostname, for production multi-tenant domains like
  // mfi-alpha.loantrack.example.com.
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const parts = hostname.split('.');
      if (parts.length > 1 && !['www', 'app'].includes(parts[0])) {
        return parts[0];
      }
    }
  }

  return '';
};

// =============================================================================
// Request interceptor
// =============================================================================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Only requests to tenant-schema endpoints need the tenant header at
    // all -- shared/public endpoints (/donors/, /aoms/, /mfis/, /users/,
    // reports, disbursements) live in the public schema regardless of
    // which MFI the caller belongs to, and sending a header the backend
    // can't resolve to a real Domain would 404 them for no reason (see
    // core/middleware.py: an unresolvable header has no public-schema
    // fallback, unlike no header at all).
    const isTenantRoute = config.url?.includes('/tenant/');

    if (isTenantRoute) {
      const subdomain = resolveTenantSubdomain();
      if (subdomain) {
        config.headers['X-Tenant-Subdomain'] = subdomain;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// =============================================================================
// Response interceptor: token refresh queue + 403 handling
// =============================================================================
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  failedQueue = [];
};

// Fired on any 403 so the app can react in one place (toast, redirect,
// etc.) instead of every call site having to check for it individually.
type ForbiddenHandler = (error: AxiosError<ApiError>) => void;
let onForbidden: ForbiddenHandler | null = null;
export const setForbiddenHandler = (handler: ForbiddenHandler | null) => {
  onForbidden = handler;
};

// Fired when the refresh token itself is invalid/expired -- the session
// is over and the app should send the user back to login.
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;
export const setSessionExpiredHandler = (handler: SessionExpiredHandler | null) => {
  onSessionExpired = handler;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // --- 401: attempt a single token refresh, queuing any requests that
    // arrive while the refresh is in flight so they retry once, not once
    // each. ---
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isTokenEndpoint = originalRequest.url?.includes('/token/');
      const refresh = getRefreshToken();

      if (isTokenEndpoint || !refresh) {
        clearTokens();
        onSessionExpired?.();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers = originalRequest.headers ?? {};
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<TokenResponse>(
          `${API_BASE_URL}/api/token/refresh/`,
          { refresh }
        );
        setTokens(data.access, data.refresh ?? refresh);
        processQueue(null, data.access);

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // --- 403: the request was authenticated but the user's role/tenant
    // doesn't permit it. This is an expected, permanent outcome of the
    // role-based access rules on the backend -- never retried, just
    // surfaced so the UI can show something better than a silent
    // failure. ---
    if (error.response?.status === 403) {
      onForbidden?.(error);
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// API Helper Functions
// =============================================================================
export const apiHelpers = {
  getAllPages: async <T>(url: string, params: Record<string, any> = {}): Promise<T[]> => {
    const results: T[] = [];
    let nextUrl: string | null = url;
    let pageParams = { ...params };

    while (nextUrl) {
      const response: any = await api.get(nextUrl, { params: pageParams });
      const data = response.data;

      if (Array.isArray(data)) {
        results.push(...(data as T[]));
        break;
      } else if (data && Array.isArray(data.results)) {
        results.push(...(data.results as T[]));
        nextUrl = data.next || null;
        pageParams = {}; // Next URL already contains params
      } else {
        break;
      }
    }
    return results;
  },

  uploadFile: async (url: string, file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  uploadCSV: async (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('csv_file', file);
    return api.post('/tenant/import-csv/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
};

export default api;
