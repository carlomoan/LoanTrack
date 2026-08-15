'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMFIDisbursements } from '@/hooks/useSharedData';
import type { MFIDisbursement } from '@/types';

const statusVariant = (s: MFIDisbursement['status']) =>
  s === 'RPD' ? 'success' : s === 'DEF' ? 'destructive' : s === 'ACT' ? 'default' : 'secondary';

/**
 * Read-only view for MFI_ADMIN / MFI_MANAGER of the wholesale capital
 * their own MFI has received from its AoM, and what's still outstanding.
 * The backend already scopes /api/mfi-disbursements/ to the caller's own
 * MFI for these roles -- no id param needed here.
 */
export default function FundingPage() {
  const { data, isLoading } = useMFIDisbursements();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Funding</h1>
        <p className="text-slate-500">
          Wholesale capital your AoM has disbursed to this MFI, and what&apos;s
          still outstanding. This is separate from the loans your MFI
          issues to individual members.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : data?.results?.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No disbursements recorded for this MFI yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((d: MFIDisbursement) => (
            <Card key={d.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    From {d.aom_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {d.principal_amount} {d.currency} at {d.interest_rate}% &middot; {d.term_months} months &middot; disbursed {new Date(d.disbursement_date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Outstanding: <span className="font-medium text-slate-700">{d.outstanding_amount} {d.currency}</span>
                  </p>
                </div>
                <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
