import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number, currency: string = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(num: string | number): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '-';
  
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercentage(value: string | number, decimals: number = 1): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  
  return `${num.toFixed(decimals)}%`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '-';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '-';
  }
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACT: 'bg-green-100 text-green-800',
    CLS: 'bg-blue-100 text-blue-800',
    DEF: 'bg-red-100 text-red-800',
    PND: 'bg-yellow-100 text-yellow-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    GENERATED: 'bg-purple-100 text-purple-800',
    URBAN: 'bg-indigo-100 text-indigo-800',
    RURAL: 'bg-green-100 text-green-800',
    PERI_URBAN: 'bg-amber-100 text-amber-800',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACT: 'Active',
    CLS: 'Closed',
    DEF: 'Defaulted',
    PND: 'Pending',
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    GENERATED: 'Generated',
    URBAN: 'Urban',
    RURAL: 'Rural',
    PERI_URBAN: 'Peri-Urban',
    IND: 'Individual',
    GRP: 'Group',
    M: 'Male',
    F: 'Female',
    O: 'Other',
    PRD: 'Principal Reduction',
    INW: 'Interest Waiver',
    WRO: 'Write Off',
    PEN: 'Penalty',
    REV: 'Reversal',
    OTH: 'Other',
    RCT: 'Receipt',
    AGR: 'Agreement',
    IDD: 'ID Document',
    COL: 'Collateral',
  };
  
  return labels[status] || status;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (!lines.length) {
          resolve([]);
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}