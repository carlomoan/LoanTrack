// components/forms/AdjustmentForm.tsx
'use client';
import { useState } from 'react';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function AdjustmentForm({ loanId }: { loanId: number }) {
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('Please attach a receipt.');

    setLoading(true);
    const formData = new FormData();
    formData.append('loan', String(loanId));
    formData.append('adjustment_type', 'RPY');
    formData.append('amount', amount);
    formData.append('attachment', file);

    try {
      await api.post('/loan-adjustments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Repayment recorded successfully!');
    } catch (err) {
      toast.error('Failed to upload adjustment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input type="number" placeholder="Amount Paid" onChange={e => setAmount(e.target.value)} required />
      <Input type="file" accept=".pdf,.png,.jpg" onChange={e => setFile(e.target.files?.[0] || null)} required />
      <Button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Submit Repayment'}</Button>
    </form>
  );
}
