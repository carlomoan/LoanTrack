'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { passwordResetApi } from '@/api/shared';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const requestReset = useMutation({
    mutationFn: (email: string) => passwordResetApi.request(email),
    onSuccess: () => setSubmitted(true),
    onError: () => {
      // The backend never returns an error for "email not found" (that
      // would leak account existence) -- an error here means something
      // genuinely went wrong (network, rate limit), so it's fine to
      // surface directly.
      toast.error('Something went wrong. Please try again in a moment.');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Reset your password</h2>
          <p className="mt-2 text-sm text-slate-500">
            Enter the email on your account and we&apos;ll send a link to set a new password.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600">
              If an account exists for <span className="font-medium">{email}</span>, a
              reset link has been sent. Check your inbox.
            </p>
            <Link href="/login" className="text-sm text-violet-600 hover:text-violet-700">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email) {
                toast.error('Enter your email address');
                return;
              }
              requestReset.mutate(email);
            }}
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={requestReset.isPending}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {requestReset.isPending ? 'Sending...' : 'Send reset link'}
            </button>
            <Link
              href="/login"
              className="block text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
