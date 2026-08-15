'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Landmark, HeartHandshake, Plus, LogIn, HandCoins, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useDonors, useCreateDonor,
  useAoMs, useCreateAoM,
  useMFIs, useCreateMFI,
  useDonorContributions, useCreateDonorContribution,
  useMFIDisbursements, useCreateMFIDisbursement, useGenerateDisbursementSchedule,
} from '@/hooks/useSharedData';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import {
  canEditAom, canEditDonor, canEditMfi,
  canManageDonorContributions, canViewDonorContributions,
  canManageDisbursements, canViewDisbursements,
} from '@/lib/permissions';
import type { AoM, Donor, DonorContribution, MFI, MFIDisbursement } from '@/types';

type Tab = 'donors' | 'aoms' | 'mfis' | 'contributions' | 'disbursements';

export default function OrganizationsPage() {
  const [tab, setTab] = useState<Tab>('mfis');
  const user = useAuthStore((state) => state.user);

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'donors', label: 'Donors', icon: HeartHandshake },
    { id: 'aoms', label: 'AoMs', icon: Landmark },
    { id: 'mfis', label: 'MFIs', icon: Building2 },
    ...(canViewDonorContributions(user)
      ? [{ id: 'contributions' as Tab, label: 'Contributions', icon: Wallet }]
      : []),
    ...(canViewDisbursements(user)
      ? [{ id: 'disbursements' as Tab, label: 'Disbursements', icon: HandCoins }]
      : []),
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
        <p className="text-slate-500">
          The Donor &rarr; AoM &rarr; MFI hierarchy. What you can see and edit here
          is scoped to your own organization.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'donors' && <DonorsTab canEdit={canEditDonor(user)} />}
      {tab === 'aoms' && <AoMsTab canEdit={canEditAom(user)} />}
      {tab === 'mfis' && <MFIsTab canEdit={canEditMfi(user)} />}
      {tab === 'contributions' && <ContributionsTab canEdit={canManageDonorContributions(user)} />}
      {tab === 'disbursements' && <DisbursementsTab canEdit={canManageDisbursements(user)} />}
    </div>
  );
}

// =============================================================================
// Donors
// =============================================================================
function DonorsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useDonors();
  const createDonor = useCreateDonor();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = async () => {
    if (!name || !email) {
      toast.error('Name and contact email are required');
      return;
    }
    try {
      await createDonor.mutateAsync({ name, contact_email: email });
      toast.success('Donor created');
      setName('');
      setEmail('');
      setShowForm(false);
    } catch {
      toast.error('Failed to create donor');
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> New Donor
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 gap-4">
            <Input placeholder="Donor name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createDonor.isPending}>
                {createDonor.isPending ? 'Saving...' : 'Save Donor'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState label="No donors visible to your account." />
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((donor: Donor) => (
            <Card key={donor.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{donor.name}</p>
                  <p className="text-sm text-slate-500">{donor.contact_email}</p>
                </div>
                <Badge variant="secondary">{donor.base_currency}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// AoMs
// =============================================================================
function AoMsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useAoMs();
  const { data: donors } = useDonors();
  const createAoM = useCreateAoM();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [donorId, setDonorId] = useState<string>('');

  const handleCreate = async () => {
    if (!name || !code || !email) {
      toast.error('Name, code, and contact email are required');
      return;
    }
    try {
      await createAoM.mutateAsync({
        name,
        code,
        contact_email: email,
        donor: donorId ? Number(donorId) : null,
      });
      toast.success('AoM created');
      setName('');
      setCode('');
      setEmail('');
      setDonorId('');
      setShowForm(false);
    } catch {
      toast.error('Failed to create AoM');
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> New AoM
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 gap-4">
            <Input placeholder="AoM name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Code (e.g. AOM1)" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input placeholder="Contact email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={donorId}
              onChange={(e) => setDonorId(e.target.value)}
            >
              <option value="">No parent donor</option>
              {donors?.results?.map((d: Donor) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createAoM.isPending}>
                {createAoM.isPending ? 'Saving...' : 'Save AoM'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState label="No AoMs visible to your account." />
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((aom: AoM) => (
            <Card key={aom.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{aom.name} <span className="text-slate-400 font-normal">({aom.code})</span></p>
                  <p className="text-sm text-slate-500">{aom.donor_name || 'No donor'}</p>
                </div>
                <Badge variant="secondary">{aom.mfi_count ?? 0} MFIs</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MFIs
// =============================================================================
function MFIsTab({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const { data, isLoading } = useMFIs();
  const { data: aoms } = useAoMs();
  const createMFI = useCreateMFI();
  const setSelectedMfi = useTenantContext((state) => state.setSelectedMfi);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', registration_number: '', email: '', phone: '', address: '', aomId: '',
  });

  const handleCreate = async () => {
    if (!form.name || !form.registration_number || !form.email) {
      toast.error('Name, registration number, and email are required');
      return;
    }
    try {
      await createMFI.mutateAsync({
        name: form.name,
        registration_number: form.registration_number,
        email: form.email,
        phone: form.phone,
        address: form.address,
        aom: form.aomId ? Number(form.aomId) : null,
        donor: null,
        license_number: '',
        local_currency: 'TZS',
        is_active: true,
        is_onboarded: false,
      } as any);
      toast.success('MFI created — its tenant schema is being provisioned.');
      setForm({ name: '', registration_number: '', email: '', phone: '', address: '', aomId: '' });
      setShowForm(false);
    } catch {
      toast.error('Failed to create MFI');
    }
  };

  const enterTenant = (mfi: MFI) => {
    setSelectedMfi({ id: mfi.id, name: mfi.name, schema_name: mfi.schema_name });
    toast.success(`Now viewing ${mfi.name}`);
    router.push('/dashboard');
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Onboard MFI
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onboard a new MFI</CardTitle>
            <CardDescription>
              Creates the MFI&apos;s public registry record and provisions its isolated tenant schema.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Input placeholder="MFI name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Registration number" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
            <Input placeholder="Contact email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.aomId}
              onChange={(e) => setForm({ ...form, aomId: e.target.value })}
            >
              <option value="">No parent AoM</option>
              {aoms?.results?.map((a: AoM) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createMFI.isPending}>
                {createMFI.isPending ? 'Provisioning...' : 'Create MFI'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState label="No MFIs visible to your account." />
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((mfi: MFI) => (
            <Card key={mfi.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{mfi.name}</p>
                  <p className="text-sm text-slate-500">{mfi.aom_name || 'No AoM'} &middot; {mfi.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={mfi.is_active ? 'success' : 'secondary'}>
                    {mfi.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => enterTenant(mfi)}>
                    <LogIn className="h-3.5 w-3.5 mr-1" /> Enter
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Donor Contributions
// =============================================================================
function ContributionsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useDonorContributions();
  const { data: donors } = useDonors();
  const { data: aoms } = useAoMs();
  const createContribution = useCreateDonorContribution();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ donorId: '', aomId: '', amount: '', date: '' });

  const handleCreate = async () => {
    if (!form.donorId || !form.aomId || !form.amount || !form.date) {
      toast.error('Donor, AoM, amount, and date are required');
      return;
    }
    try {
      await createContribution.mutateAsync({
        donor: Number(form.donorId),
        aom: Number(form.aomId),
        amount: form.amount,
        contribution_date: form.date,
      });
      toast.success('Contribution recorded');
      setForm({ donorId: '', aomId: '', amount: '', date: '' });
      setShowForm(false);
    } catch {
      toast.error("Failed to record contribution — check the AoM's sponsoring donor matches.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 -mt-2">
        Capital a donor has injected into an AoM. This is the top of the
        fund chain — the AoM re-lends it to MFIs via Disbursements below.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Record Contribution
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 gap-4">
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.donorId}
              onChange={(e) => setForm({ ...form, donorId: e.target.value })}
            >
              <option value="">Select donor</option>
              {donors?.results?.map((d: Donor) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.aomId}
              onChange={(e) => setForm({ ...form, aomId: e.target.value })}
            >
              <option value="">Select AoM</option>
              {aoms?.results?.map((a: AoM) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Input placeholder="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input placeholder="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createContribution.isPending}>
                {createContribution.isPending ? 'Saving...' : 'Record Contribution'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState label="No contributions in your scope." />
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((c: DonorContribution) => (
            <Card key={c.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.donor_name} &rarr; {c.aom_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(c.contribution_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary">{c.amount} {c.currency}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MFI Disbursements
// =============================================================================
function DisbursementsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useMFIDisbursements();
  const { data: aoms } = useAoMs();
  const { data: mfis } = useMFIs();
  const createDisbursement = useCreateMFIDisbursement();
  const generateSchedule = useGenerateDisbursementSchedule();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    aomId: '', mfiId: '', principal: '', rate: '', term: '', date: '',
  });

  const handleCreate = async () => {
    if (!form.aomId || !form.mfiId || !form.principal || !form.rate || !form.term || !form.date) {
      toast.error('All fields are required');
      return;
    }
    try {
      await createDisbursement.mutateAsync({
        aom: Number(form.aomId),
        mfi: Number(form.mfiId),
        principal_amount: form.principal,
        interest_rate: form.rate,
        term_months: Number(form.term),
        disbursement_date: form.date,
      });
      toast.success('Disbursement created');
      setForm({ aomId: '', mfiId: '', principal: '', rate: '', term: '', date: '' });
      setShowForm(false);
    } catch {
      toast.error('Failed to create disbursement — check the MFI belongs to the selected AoM.');
    }
  };

  const statusVariant = (s: MFIDisbursement['status']) =>
    s === 'RPD' ? 'success' : s === 'DEF' ? 'destructive' : s === 'ACT' ? 'default' : 'secondary';

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 -mt-2">
        Wholesale loans from an AoM to its MFIs — the capital an MFI
        re-lends onward to individual members at its own rate. This is
        the AoM&apos;s ledger, not the MFI&apos;s individual loan book.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> New Disbursement
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disburse to an MFI</CardTitle>
            <CardDescription>Sets the wholesale rate and term; the repayment schedule is generated afterward.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.aomId}
              onChange={(e) => setForm({ ...form, aomId: e.target.value })}
            >
              <option value="">Select AoM</option>
              {aoms?.results?.map((a: AoM) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.mfiId}
              onChange={(e) => setForm({ ...form, mfiId: e.target.value })}
            >
              <option value="">Select MFI</option>
              {mfis?.results?.map((m: MFI) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Input placeholder="Principal amount" type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} />
            <Input placeholder="Interest rate (%)" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <Input placeholder="Term (months)" type="number" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
            <Input placeholder="Disbursement date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createDisbursement.isPending}>
                {createDisbursement.isPending ? 'Saving...' : 'Create Disbursement'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : data?.results?.length === 0 ? (
        <EmptyState label="No disbursements in your scope." />
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((d: MFIDisbursement) => (
            <Card key={d.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {d.aom_name} &rarr; {d.mfi_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {d.principal_amount} {d.currency} at {d.interest_rate}% &middot; {d.term_months}mo &middot; outstanding {d.outstanding_amount}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  {canEdit && d.status === 'PND' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generateSchedule.isPending}
                      onClick={async () => {
                        try {
                          await generateSchedule.mutateAsync(d.id);
                          toast.success('Repayment schedule generated');
                        } catch {
                          toast.error('Failed to generate schedule');
                        }
                      }}
                    >
                      Generate Schedule
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-sm text-slate-500">{label}</div>
  );
}
