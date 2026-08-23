'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Circle, CircleAlert, CircleDot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useMFIDisbursement, useRecordDisbursementPayment } from '@/hooks/useSharedData';
import { useAuthStore } from '@/hooks/useAuthStore';
import { canRecordDisbursementPayment } from '@/lib/permissions';
import type { MFIDisbursementRepayment } from '@/types';

/**
 * Full repayment breakdown for a single wholesale disbursement:
 * installment by installment, how much of the expected principal vs
 * interest has actually been paid, and what's still owed. This is the
 * "has my disbursement to this MFI been repaid, and in what steps"
 * view.
 */
export default function DisbursementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const user = useAuthStore((state) => state.user);
  const canRecord = canRecordDisbursementPayment(user);

  const { data: disbursement, isLoading } = useMFIDisbursement(id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
      </div>
    );
  }

  if (!disbursement) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-12 text-sm text-slate-500">
        Disbursement not found, or you don&apos;t have access to it.
      </div>
    );
  }

  const schedule = disbursement.schedule ?? [];
  const paidCount = schedule.filter((r) => installmentState(r) === 'paid').length;
  const partialCount = schedule.filter((r) => installmentState(r) === 'partial').length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => router.push('/dashboard/organizations?tab=disbursements')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Disbursements
      </button>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {disbursement.aom_name} &rarr; {disbursement.mfi_name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {disbursement.principal_amount} {disbursement.currency} at {disbursement.interest_rate}% &middot; {disbursement.term_months} months
              </p>
            </div>
            <Badge variant={
              disbursement.status === 'RPD' ? 'success'
              : disbursement.status === 'DEF' ? 'destructive'
              : disbursement.status === 'ACT' ? 'default' : 'secondary'
            }>
              {disbursement.status}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <Stat label="Outstanding" value={`${disbursement.outstanding_amount} ${disbursement.currency}`} />
            <Stat label="Repaid so far" value={`${disbursement.repaid_amount} ${disbursement.currency}`} />
            <Stat label="Installments" value={`${paidCount} paid, ${partialCount} partial, of ${schedule.length}`} />
          </div>
        </CardContent>
      </Card>

      {schedule.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No repayment schedule generated for this disbursement yet.
        </div>
      ) : (
        <div className="space-y-2">
          {schedule.map((installment) => (
            <InstallmentRow
              key={installment.id}
              installment={installment}
              currency={disbursement.currency}
              canRecord={canRecord}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

type InstallmentState = 'paid' | 'partial' | 'overdue' | 'pending';

function installmentState(r: MFIDisbursementRepayment): InstallmentState {
  const paid = Number(r.actual_paid);
  const total = Number(r.expected_total);
  if (r.is_paid || paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  if (r.days_overdue > 0) return 'overdue';
  return 'pending';
}

const stateConfig: Record<InstallmentState, { label: string; icon: typeof CheckCircle2; badge: 'success' | 'default' | 'destructive' | 'secondary' }> = {
  paid: { label: 'Paid in full', icon: CheckCircle2, badge: 'success' },
  partial: { label: 'Partially paid', icon: CircleDot, badge: 'default' },
  overdue: { label: 'Overdue', icon: CircleAlert, badge: 'destructive' },
  pending: { label: 'Pending', icon: Circle, badge: 'secondary' },
};

function InstallmentRow({
  installment, currency, canRecord,
}: {
  installment: MFIDisbursementRepayment;
  currency: string;
  canRecord: boolean;
}) {
  const state = installmentState(installment);
  const config = stateConfig[state];
  const Icon = config.icon;
  const [showPayForm, setShowPayForm] = useState(false);
  const [amount, setAmount] = useState('');
  const recordPayment = useRecordDisbursementPayment();

  // Once principal AND interest are both fully covered, this installment
  // is "paid with interest". A principal-only settlement (interest
  // waived via a LoanAdjustment-equivalent business decision) would show
  // paid_amount covering principal but leave expected_interest
  // uncollected -- that distinction is visible directly from the two
  // columns below rather than a separate flag.
  const principalCovered = Math.min(Number(installment.actual_paid), Number(installment.expected_principal));
  const interestCovered = Math.max(0, Number(installment.actual_paid) - Number(installment.expected_principal));

  const handleRecord = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter an amount greater than zero');
      return;
    }
    try {
      await recordPayment.mutateAsync({ id: installment.id, amount });
      toast.success('Payment recorded');
      setAmount('');
      setShowPayForm(false);
    } catch {
      toast.error('Failed to record payment');
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${
              state === 'paid' ? 'text-emerald-500'
              : state === 'partial' ? 'text-violet-500'
              : state === 'overdue' ? 'text-red-500' : 'text-slate-300'
            }`} />
            <div>
              <p className="font-medium text-slate-900">
                Installment {installment.installment_number} &middot; due {new Date(installment.due_date).toLocaleDateString()}
              </p>
              <p className="text-xs text-slate-500">
                Principal: {principalCovered.toFixed(2)} / {installment.expected_principal} &middot; Interest: {interestCovered.toFixed(2)} / {installment.expected_interest} {currency}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={config.badge}>{config.label}</Badge>
            {canRecord && state !== 'paid' && (
              <Button size="sm" variant="outline" onClick={() => setShowPayForm((v) => !v)}>
                Record Payment
              </Button>
            )}
          </div>
        </div>

        {showPayForm && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
            <Input
              type="number"
              placeholder={`Amount (remaining: ${installment.remaining_amount ?? ''})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-[220px]"
            />
            <Button size="sm" onClick={handleRecord} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
