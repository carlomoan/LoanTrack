'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActivity } from '@/hooks/useTenantData';
import { Plus, Pencil, Trash2, History } from 'lucide-react';
import type { ActivityChangeType, ActivityEntry } from '@/types';

const CHANGE_ICON: Record<ActivityChangeType, typeof Plus> = {
  created: Plus,
  changed: Pencil,
  deleted: Trash2,
};

const CHANGE_BADGE: Record<ActivityChangeType, 'success' | 'default' | 'destructive'> = {
  created: 'success',
  changed: 'default',
  deleted: 'destructive',
};

const MODEL_LABELS: Record<string, string> = {
  Loan: 'Loan',
  Member: 'Member',
  LoanAdjustment: 'Loan Adjustment',
  Branch: 'Branch',
};

/**
 * Who changed what, and when -- across loans, members, loan adjustments,
 * and branches. Every one of these already has full history tracking
 * (django-simple-history); this is just the first place that shows it.
 */
export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = useActivity({ page, page_size: pageSize });

  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History className="h-6 w-6 text-slate-400" /> Activity
        </h1>
        <p className="text-slate-500">
          A record of changes to loans, members, loan adjustments, and branches.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
        </div>
      ) : !data || data.results.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">No activity recorded yet.</div>
      ) : (
        <>
          <div className="space-y-2">
            {data.results.map((entry) => (
              <ActivityRow key={`${entry.model}-${entry.history_id}`} entry={entry} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const Icon = CHANGE_ICON[entry.change_type];

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            entry.change_type === 'created' ? 'bg-emerald-100 text-emerald-600'
            : entry.change_type === 'deleted' ? 'bg-red-100 text-red-600'
            : 'bg-violet-100 text-violet-600'
          }`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-900">{entry.object_repr}</span>
              <Badge variant="outline">{MODEL_LABELS[entry.model] ?? entry.model}</Badge>
              <Badge variant={CHANGE_BADGE[entry.change_type]}>{entry.change_type}</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {entry.changed_by ?? 'System'} &middot; {new Date(entry.changed_at).toLocaleString()}
            </p>
            {entry.changed_fields.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Changed: {entry.changed_fields.join(', ')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
