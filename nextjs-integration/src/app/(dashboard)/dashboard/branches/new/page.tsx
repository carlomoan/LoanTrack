// src/app/(dashboard)/dashboard/branches/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCreateBranch } from '@/hooks/useBranches';
import { Input } from '@/components/ui/input';
import { MapAreaPicker, AreaSelection } from '@/components/forms/MapAreaPicker';
import { Steps, ReviewRow, WizardFooter } from '@/components/forms/Wizard';
import { showApiError } from '@/lib/api-errors';

export default function NewBranchPage() {
  const router = useRouter();
  const createBranch = useCreateBranch();
  const [step, setStep] = useState(0);
  const [area, setArea] = useState<AreaSelection | null>(null);
  const [form, setForm] = useState({ name: '', code: '', manager_name: '', manager_phone: '' });
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const next = async () => {
    if (step === 0 && (!form.name || !form.code)) return toast.error('Name and code are required');
    if (step === 1 && !area?.street) return toast.error('Pick and confirm an area on the map');
    if (step < 2) return setStep(step + 1);

    try {
      await createBranch.mutateAsync({
        name: form.name,
        code: form.code,
        street: area!.street!.id,
        manager_name: form.manager_name || '',
        manager_phone: form.manager_phone || '',
        is_active: true,
      } as any);
      toast.success('Branch created');
      router.push('/dashboard/branches');
    } catch (e) {
      showApiError(e, 'Branch creation failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-slate-900 mb-4">New Branch</h1>
      <Steps steps={['Details', 'Location', 'Review']} current={step} />

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Input className="col-span-2" placeholder="Branch name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
          <Input placeholder="Code *" value={form.code} onChange={(e) => set('code', e.target.value)} />
          <Input placeholder="Manager name" value={form.manager_name} onChange={(e) => set('manager_name', e.target.value)} />
          <Input className="col-span-2" placeholder="Manager phone" value={form.manager_phone} onChange={(e) => set('manager_phone', e.target.value)} />
        </div>
      )}

      {step === 1 && <MapAreaPicker value={area} onChange={setArea} />}

      {step === 2 && (
        <div>
          <ReviewRow label="Name" value={form.name} />
          <ReviewRow label="Code" value={form.code} />
          <ReviewRow label="Manager" value={form.manager_name} />
          <ReviewRow label="Street" value={area?.street?.name} />
          <ReviewRow label="Ward" value={area?.ward?.name} />
          <ReviewRow label="District" value={area?.district?.name} />
          <ReviewRow label="Region" value={area?.region?.name} />
        </div>
      )}

      <WizardFooter step={step} total={3} onBack={() => setStep(Math.max(0, step - 1))} onNext={next} submitting={createBranch.isPending} />
    </div>
  );
}
