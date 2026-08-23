'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { passwordResetApi } from '@/api/shared';

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const uid = String(params.uid);
  const token = String(params.token);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const confirmReset = useMutation({
    mutationFn: () => passwordResetApi.confirm(uid, token, password),
    onSuccess: () => {
      toast.success('Password reset. Please sign in with your new password.');
      router.push('/login');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail;
      toast.error(message || 'This reset link is invalid or has expired.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    confirmReset.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Set a new password</h2>
          <p className="mt-2 text-sm text-slate-500">
            This link can only be used once, and expires after a few hours.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <button
            type="submit"
            disabled={confirmReset.isPending}
            className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
          >
            {confirmReset.isPending ? 'Saving...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}
