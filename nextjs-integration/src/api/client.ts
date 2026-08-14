import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse, ApiError } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TENANT_SUBDOMAIN = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN || '';

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tenantSchema: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access; refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }
};

export const setTenantSchema = (schema: string) => {
  tenantSchema = schema;
  if (typeof window !== 'undefined') {
    localStorage.setItem('tenant_schema', schema);
  }
};

export const getTenantSchema = (): string | null => {
  if (tenantSchema) return tenantSchema;
  if (typeof window !== 'undefined') return localStorage.getItem('tenant_schema');
  return null;
};

export const clearTenantSchema = () => {
  tenantSchema = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tenant_schema');
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
  accessToken = null; refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
};

// =============================================================================
// API Helper Functions
// =============================================================================
export const apiHelpers = {
  // Pagination helper
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

  // Generic File upload
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

  // CSV upload with progress
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

// Request Interceptor - Add auth token and tenant header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Skip tenant header for public schema routes (auth, users, donors, aoms, mfis, etc.)
    // These endpoints are in the public/shared schema, not tenant-specific
    const publicRoutes = [
      '/token/',
      '/users/',
      '/donors/',
      '/aoms/',
      '/mfis/',
      '/domains/',
      '/exchange-rates/',
      '/mfi-reports/',
      '/aom-reports/',
      '/donor-reports/',
    ];
    const isPublicRoute = publicRoutes.some((route) => config.url?.includes(route));

    if (!isPublicRoute) {
      let subdomain = TENANT_SUBDOMAIN;
      if (!subdomain && typeof window !== 'undefined') {
        // Use user's tenant schema if available
        const userSchema = getTenantSchema();
        if (userSchema) {
          subdomain = userSchema;
        } else if (TENANT_SUBDOMAIN) {
          // Use env var if set
          subdomain = TENANT_SUBDOMAIN;
        } else {
          // Fallback to hostname-based detection for production
          const hostname = window.location.hostname;
          if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            const parts = hostname.split('.');
            if (parts.length > 1 && !['www', 'app', 'localhost'].includes(parts[0])) {
              subdomain = parts[0];
            }
          } else {
            // Development fallback - use first available tenant
            subdomain = 'mfi1';
          }
        }
      }
      if (subdomain) {
        config.headers['X-Tenant-Subdomain'] = subdomain;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor - Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void; }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token!));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until token refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post<TokenResponse>(
          `${API_BASE_URL}/api/token/refresh/`,
          { refresh: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access, refresh } = response.data;
        setTokens(access, refresh);
        processQueue(null, access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;