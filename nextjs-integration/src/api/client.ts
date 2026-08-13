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

export const setTokens = (access: string, refresh: string) => {
  accessToken = access; refreshToken = refresh;
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
  // Pagination helper
  getAllPages: async <T>(url: string, params: Record<string, any> = {}): Promise<T[]> => {
    const results: T[] = [];
    let nextUrl: string | null = url;
    let pageParams = { ...params };

    while (nextUrl) {
      // EXPLICITLY type the response variable to satisfy strict TypeScript
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

// src/api/client.ts (Inside the request interceptor)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Smart Subdomain Extraction
    let subdomain = TENANT_SUBDOMAIN;
    if (!subdomain && typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      // Fallback for local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        subdomain = 'mfi1'; // ⚠️ CHANGE THIS to your actual tenant schema name (e.g., 'tenant_mfi1' or just 'mfi1')
      } else {
        const parts = hostname.split('.');
        if (parts.length > 1 && !['www', 'app', 'localhost'].includes(parts[0])) {
          subdomain = parts[0];
        }
      }
    }

    if (subdomain) {
      config.headers['X-Tenant-Subdomain'] = subdomain;
    }

    return config;
  },
  (error) => Promise.reject(error)
);
// Response interceptor (Token Refresh Queue)
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void; }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token!));
  failedQueue = [];
};

// src/api/client.ts (Request Interceptor)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ Skip tenant header for public auth routes so they hit the public schema
    const isPublicAuthRoute = config.url?.includes('/token/') || config.url === '/token';

    if (!isPublicAuthRoute) {
      let subdomain = TENANT_SUBDOMAIN;
      if (!subdomain && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          subdomain = 'mfi1';
        } else {
          const parts = hostname.split('.');
          if (parts.length > 1 && !['www', 'app', 'localhost'].includes(parts[0])) {
            subdomain = parts[0];
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

export default api;
