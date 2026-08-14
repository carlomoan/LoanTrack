import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors';

  const variants: Record<string, string> = {
    default: 'border-transparent bg-indigo-100 text-indigo-800',
    secondary: 'border-transparent bg-slate-100 text-slate-700',
    destructive: 'border-transparent bg-red-100 text-red-800',
    outline: 'border-slate-200 text-slate-700',
    success: 'border-transparent bg-emerald-100 text-emerald-800',
    warning: 'border-transparent bg-amber-100 text-amber-800',
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
