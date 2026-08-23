'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExchangeRates, useCreateExchangeRate } from '@/hooks/useSharedData';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDefaultCurrency, useUpdateSystemSettings } from '@/hooks/useSystemSettings';
import { canEditExchangeRates } from '@/lib/permissions';
import type { ExchangeRate } from '@/types';

/**
 * Every MFI has its own local_currency; every Donor has its own
 * base_currency. Reports (MFIReport/AoMReport/DonorReport) convert
 * between them using whichever rate is current for that currency pair --
 * this page is where that rate actually comes from. Writes are
 * SUPER_ADMIN-only: a bad rate here silently skews every report that
 * reads it, so it isn't something any org-level role should touch.
 */
export default function CurrencyPage() {
  const user = useAuthStore((state) => state.user);
  const canEdit = canEditExchangeRates(user);
  const defaultCurrency = useDefaultCurrency();
  const updateSettings = useUpdateSystemSettings();
  const [editingDefault, setEditingDefault] = useState(false);
  const [newDefault, setNewDefault] = useState('');
  const { data, isLoading } = useExchangeRates();
  const createRate = useCreateExchangeRate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', rate: '', date: '', source: '' });

  const handleSaveDefault = async () => {
    if (!/^[A-Za-z]{3}$/.test(newDefault.trim())) {
      toast.error('Enter a 3-letter currency code (e.g. TZS)');
      return;
    }
    try {
      await updateSettings.mutateAsync({ default_currency: newDefault.trim().toUpperCase() });
      toast.success(`Default currency set to ${newDefault.trim().toUpperCase()}`);
      setEditingDefault(false);
    } catch {
      toast.error('Only a super admin can change the default currency');
    }
  };

  const handleCreate = async () => {
    if (!form.from || !form.to || !form.rate || !form.date) {
      toast.error('From/to currency, rate, and date are required');
      return;
    }
    try {
      await createRate.mutateAsync({
        from_currency: form.from.toUpperCase(),
        to_currency: form.to.toUpperCase(),
        rate: form.rate,
        date: form.date,
        source: form.source,
      });
      toast.success('Exchange rate added');
      setForm({ from: '', to: '', rate: '', date: '', source: '' });
      setShowForm(false);
    } catch {
      toast.error('Failed to add exchange rate');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Currency &amp; Exchange Rates</h1>
          <p className="text-slate-500">
            Rates used to convert between each MFI&apos;s local currency
            and each donor&apos;s reporting currency.
          </p>
        </div>
      </div>

      {/* System-wide default currency */}
      <Card className="mb-6 border-violet-100 bg-violet-50/40">
        <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-900">System default currency</p>
            <p className="text-sm text-slate-500 mt-0.5">
              All money amounts across the app display in this currency. Tanzania&apos;s shilling (TZS) is the shipped default; changing it affects every user.
            </p>
          </div>
          {editingDefault ? (
            <div className="flex items-center gap-2">
              <Input
                className="w-28"
                maxLength={3}
                placeholder="TZS"
                value={newDefault}
                onChange={(e) => setNewDefault(e.target.value.toUpperCase())}
              />
              <Button size="sm" onClick={handleSaveDefault} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingDefault(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-lg font-bold text-violet-700 tracking-wide">
                {defaultCurrency}
              </span>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => { setNewDefault(defaultCurrency); setEditingDefault(true); }}>
                  Change
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!canEdit && (
        <p className="text-sm text-slate-400 mb-4">
          You have read-only access to exchange rates. Only a super admin can add or change them.
        </p>
      )}

      <div className="mb-6 flex justify-end">
        {canEdit && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Add Rate
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Add an exchange rate</CardTitle>
            <CardDescription>e.g. 1 USD = 2,600 TZS, effective a given date.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Input placeholder="From currency (e.g. USD)" maxLength={3} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
            <Input placeholder="To currency (e.g. TZS)" maxLength={3} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
            <Input placeholder="Rate" type="number" step="0.0001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <Input placeholder="Effective date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Input placeholder="Source (optional)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="col-span-2" />
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createRate.isPending}>
                {createRate.isPending ? 'Saving...' : 'Add Rate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
        </div>
      ) : data?.results?.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">No exchange rates recorded yet.</div>
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((r: ExchangeRate) => (
            <Card key={r.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      1 {r.from_currency} = {r.rate} {r.to_currency}
                    </p>
                    <p className="text-sm text-slate-500">
                      Effective {new Date(r.date).toLocaleDateString()}
                      {r.source && ` \u00b7 ${r.source}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
