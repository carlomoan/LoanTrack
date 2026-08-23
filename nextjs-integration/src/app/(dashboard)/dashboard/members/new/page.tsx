// src/app/(dashboard)/dashboard/members/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCreateMember } from '@/hooks/useMembers';
import { useBranches } from '@/hooks/useBranches';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MapAreaPicker, AreaSelection } from '@/components/forms/MapAreaPicker';
import { Steps, ReviewRow, WizardFooter } from '@/components/forms/Wizard';
import { showApiError } from '@/lib/api-errors';

export default function NewMemberPage() {
  const router = useRouter();
  const createMember = useCreateMember();
  const { data: branches } = useBranches({ page_size: 100 });

  const [step, setStep] = useState(0);
  const [area, setArea] = useState<AreaSelection | null>(null);
  const [form, setForm] = useState({
    name: '', gender: 'F', borrower_type: 'IND', phone: '', national_id: '',
    branch: '', loan_officer: '',
  });
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const next = async () => {
    if (step === 0 && !form.name) return toast.error('Name is required');
    if (step === 0 && !form.phone) return toast.error('Phone is required');
    if (step === 1 && !area?.street) return toast.error('Pick and confirm an area on the map');
    if (step < 2) return setStep(step + 1);

    try {
      await createMember.mutateAsync({
        name: form.name,
        gender: form.gender,
        borrower_type: form.borrower_type,
        phone: form.phone,
        // NIDA is optional -- omit the key entirely when blank rather than
        // sending null, which the backend's NOT NULL CharField rejects.
        ...(form.national_id.trim() ? { national_id: form.national_id.trim() } : {}),
        street: area!.street!.id,
        branch: form.branch ? Number(form.branch) : null,
        loan_officer: form.loan_officer ? Number(form.loan_officer) : null,
        joined_date: new Date().toISOString().split('T')[0],
        is_active: true,
      } as any);
      toast.success('Member created');
      router.push('/dashboard/members');
    } catch (e) {
      showApiError(e, 'Member creation failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-4">New Member</h1>
      <Steps steps={['Personal', 'Location', 'Review']} current={step} />

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Input className="col-span-2" placeholder="Full name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="F">Female</SelectItem>
              <SelectItem value="M">Male</SelectItem>
              <SelectItem value="O">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.borrower_type} onValueChange={(v) => set('borrower_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IND">Individual</SelectItem>
              <SelectItem value="GRP">Group</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Phone *" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input placeholder="National ID (optional)" value={form.national_id} onChange={(e) => set('national_id', e.target.value)} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <MapAreaPicker value={area} onChange={setArea} />
          <Select value={form.branch} onValueChange={(v) => set('branch', v)}>
            <SelectTrigger><SelectValue placeholder="Branch (optional)" /></SelectTrigger>
            <SelectContent>
              {branches?.results?.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {step === 2 && (
        <div>
          <ReviewRow label="Name" value={form.name} />
          <ReviewRow label="Gender / Type" value={`${form.gender} / ${form.borrower_type}`} />
          <ReviewRow label="Phone" value={form.phone} />
          <ReviewRow label="National ID" value={form.national_id} />
          <ReviewRow label="Street" value={area?.street?.name} />
          <ReviewRow label="Ward" value={area?.ward?.name} />
          <ReviewRow label="District" value={area?.district?.name} />
          <ReviewRow label="Region" value={area?.region?.name} />
          <ReviewRow label="Coordinates" value={area ? `${area.lat.toFixed(5)}, ${area.lng.toFixed(5)}` : null} />
        </div>
      )}

      <WizardFooter step={step} total={3} onBack={() => setStep(Math.max(0, step - 1))} onNext={next} submitting={createMember.isPending} />
    </div>
  );
}
