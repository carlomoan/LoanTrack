// src/components/forms/Wizard.tsx
'use client';

import { Button } from '@/components/ui/button';
import { clsx } from 'clsx';

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={clsx(
              'h-6 w-6 rounded-full text-xs flex items-center justify-center font-bold',
              i <= current ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'
            )}
          >
            {i + 1}
          </span>
          <span className={clsx('text-sm', i === current ? 'font-medium text-slate-900' : 'text-slate-500')}>
            {s}
          </span>
          {i < steps.length - 1 && <span className="w-6 h-px bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || value === 0 ? String(value) : '—'}</span>
    </div>
  );
}

export function WizardFooter({ step, total, onBack, onNext, submitting, submitLabel }: {
  step: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      {step > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
      )}
      <Button type="button" size="sm" onClick={onNext} disabled={submitting}>
        {submitting ? 'Saving…' : step === total - 1 ? submitLabel || 'Submit' : 'Next'}
      </Button>
    </div>
  );
}
