// src/lib/api-errors.ts
import { toast } from 'sonner';

export function showApiError(error: any, fallback: string) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  console.error(`[API ${status}]`, data);
  if (data && typeof data === 'object') {
    const msgs = Object.entries(data)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
      .join('  •  ');
    toast.error(`${fallback} (${status}) — ${msgs}`);
  } else {
    toast.error(`${fallback} (${status ?? 'network'})`);
  }
}
