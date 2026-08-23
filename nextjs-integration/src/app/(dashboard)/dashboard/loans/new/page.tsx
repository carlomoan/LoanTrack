// src/app/(dashboard)/dashboard/loans/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCreateLoan } from '@/hooks/useLoans';
import { useMembers } from '@/hooks/useMembers';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Steps, ReviewRow, WizardFooter } from '@/components/forms/Wizard';
import { showApiError } from '@/lib/api-errors';

export default function NewLoanPage() {
  const router = useRouter();
  const createLoan = useCreateLoan();
  const { data: members } = useMembers({ page_size: 100 });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    member: '', product_type: 'Standard Loan', loan_amount: '', loan_term: '12',
    interest_rate: '10', disbursement_date: new Date().toISOString().split('T')[0],
  });
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const memberName = members?.results?.find((m) => String(m.id) === form.member)?.name;

  const next = async () => {
    if (step === 0) {
      if (!form.member) return toast.error('Select a member');
      if (!Number(form.loan_amount)) return toast.error('Loan amount must be > 0');
      if (!Number(form.loan_term)) return toast.error('Term must be > 0');
    }
    if (step < 1) return setStep(1);

    try {
      await createLoan.mutateAsync({
        member: Number(form.member),
        branch: null,
        loan_officer: null,
        product_type: form.product_type,
        disbursement_date: form.disbursement_date,
        status: 'PND',
        water_component: false,
        interest_rate: form.interest_rate,
        loan_term: Number(form.loan_term),
        loan_amount: form.loan_amount,
        repaid_amount: '0',
        // outstanding_amount intentionally omitted — Django computes it
      } as any);
      toast.success('Loan created');
      router.push('/dashboard/loans');
    } catch (e) {
      showApiError(e, 'Loan creation failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-4">New Loan</h1>
      <Steps steps={['Terms', 'Review']} current={step} />

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Select value={form.member} onValueChange={(v) => set('member', v)}>
            <SelectTrigger className="col-span-2"><SelectValue placeholder="Member *" /></SelectTrigger>
            <SelectContent>
              {members?.results?.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.member_id})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Product type" value={form.product_type} onChange={(e) => set('product_type', e.target.value)} />
          <Input type="number" placeholder="Amount *" value={form.loan_amount} onChange={(e) => set('loan_amount', e.target.value)} />
          <Input type="number" placeholder="Term (months) *" value={form.loan_term} onChange={(e) => set('loan_term', e.target.value)} />
          <Input type="number" step="0.01" placeholder="Rate %" value={form.interest_rate} onChange={(e) => set('interest_rate', e.target.value)} />
          <Input type="date" className="col-span-2" value={form.disbursement_date} onChange={(e) => set('disbursement_date', e.target.value)} />
        </div>
      )}

      {step === 1 && (
        <div>
          <ReviewRow label="Member" value={memberName} />
          <ReviewRow label="Product" value={form.product_type} />
          <ReviewRow label="Amount" value={form.loan_amount} />
          <ReviewRow label="Term" value={`${form.loan_term} months`} />
          <ReviewRow label="Interest" value={`${form.interest_rate}%`} />
          <ReviewRow label="Disbursement" value={form.disbursement_date} />
        </div>
      )}

      <WizardFooter step={step} total={2} onBack={() => setStep(0)} onNext={next} submitting={createLoan.isPending} />
    </div>
  );
}
