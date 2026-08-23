'use client';

import { useState } from 'react';
import { useLoanAdjustments, useApproveLoanAdjustment, useRejectLoanAdjustment } from '@/hooks/useLoanAdjustments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import { canApproveLoanAdjustments } from '@/lib/permissions';
import { formatCurrency } from '@/utils/helpers';
import { useDefaultCurrency } from '@/hooks/useSystemSettings';

export default function LoanAdjustmentsPage() {
  const user = useAuthStore((state) => state.user);
  const canApprove = canApproveLoanAdjustments(user);
  const currency = useDefaultCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: adjustments, isLoading } = useLoanAdjustments({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    adjustment_type: typeFilter || undefined,
    is_approved: statusFilter === 'approved' ? true : statusFilter === 'pending' ? false : undefined,
  });

  const approveLoanAdjustment = useApproveLoanAdjustment();
  const rejectLoanAdjustment = useRejectLoanAdjustment();

  const handleReject = async (adjustmentId: number) => {
    const reason = prompt('Reason for rejection (recorded in the audit trail):') || '';
    try {
      await rejectLoanAdjustment.mutateAsync({ id: adjustmentId, reason });
      toast.success('Loan adjustment rejected');
    } catch (error) {
      toast.error('Failed to reject adjustment');
    }
  };

  const handleApprove = async (adjustmentId: number) => {
    try {
      await approveLoanAdjustment.mutateAsync(adjustmentId);
      toast.success('Loan adjustment approved successfully!');
    } catch (error) {
      toast.error('Failed to approve adjustment');
    }
  };

  const getStatusColor = (isApproved: boolean) => {
    return isApproved 
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';
  };

  const getStatusText = (isApproved: boolean) => {
    return isApproved ? 'Approved' : 'Pending';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loan Adjustments</h1>
        <p className="text-gray-600">Manage loan adjustments and approvals</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter adjustments by type, status or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by loan number or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adjustment Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="PRD">Principal Reduction</SelectItem>
                  <SelectItem value="INW">Interest Waiver</SelectItem>
                  <SelectItem value="WRO">Write Off</SelectItem>
                  <SelectItem value="PEN">Penalty</SelectItem>
                  <SelectItem value="REV">Reversal</SelectItem>
                  <SelectItem value="OTH">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Adjustments ({adjustments?.count || 0})</CardTitle>
          <CardDescription>All loan adjustments in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading adjustments...</p>
            </div>
          ) : adjustments?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No adjustments found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adjustments?.results?.map((adjustment) => (
                <div key={adjustment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Loan #{adjustment.loan_number} - {adjustment.adjustment_type}
                    </p>
                    <p className="text-sm text-gray-500">{adjustment.reason}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(adjustment.amount || 0, currency)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium text-gray-900">
                      {adjustment.adjustment_type === 'PRD' ? 'Principal' :
                       adjustment.adjustment_type === 'INW' ? 'Interest' :
                       adjustment.adjustment_type === 'WRO' ? 'Write-off' :
                       adjustment.adjustment_type === 'PEN' ? 'Penalty' :
                       adjustment.adjustment_type === 'REV' ? 'Reversal' : 'Other'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(adjustment.is_approved)}`}>
                      {getStatusText(adjustment.is_approved)}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Reference</p>
                    <p className="font-medium text-gray-900">
                      {adjustment.reference_number || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Created By</p>
                    <p className="font-medium text-gray-900">
                      {adjustment.created_by_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    {adjustment.is_approved ? (
                      <span className="text-sm text-green-600 font-medium">
                        Approved {adjustment.approved_at ? new Date(adjustment.approved_at).toLocaleDateString() : ''}
                      </span>
                    ) : canApprove ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(adjustment.id)}
                          disabled={approveLoanAdjustment.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(adjustment.id)}
                          disabled={rejectLoanAdjustment.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {(adjustments?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((adjustments?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((adjustments?.count || 0) / 10)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}