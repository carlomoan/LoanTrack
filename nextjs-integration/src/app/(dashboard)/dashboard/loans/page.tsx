// src/app/(dashboard)/loans/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLoans } from '@/hooks/useLoans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuthStore } from '@/hooks/useAuthStore';
import { canWriteTenantData } from '@/lib/permissions';

export default function LoansPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const { data: loans, isLoading } = useLoans({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    status: statusFilter || undefined,
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans Management</h1>
          <p className="text-gray-600">Manage all loans and disbursements</p>
        </div>
        {canWriteTenantData(user) && (
          <Button onClick={() => router.push('/dashboard/loans/new')}>
            Create Loan
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter loans by status or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <Input
                placeholder="Search by loan number or member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="ACT">Active</SelectItem>
                  <SelectItem value="CLS">Closed</SelectItem>
                  <SelectItem value="DEF">Defaulted</SelectItem>
                  <SelectItem value="PND">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
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

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loans ({loans?.count || 0})</CardTitle>
          <CardDescription>All loan records in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading loans...</p>
            </div>
          ) : (loans?.results?.length ?? 0) === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No loans found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {loans?.results?.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{loan.loan_number}</p>
                    {/* ✅ Use flat member_name, not loan.member?.name */}
                    <p className="text-sm text-gray-500">{loan.member_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium text-gray-900">
                      ${parseFloat(loan.loan_amount || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${loan.status === 'ACT' ? 'bg-green-100 text-green-800' :
                        loan.status === 'CLS' ? 'bg-gray-100 text-gray-800' :
                        loan.status === 'DEF' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'}`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Officer</p>
                    {/* ✅ Use flat loan_officer_name, not loan.loan_officer?.name */}
                    <p className="font-medium text-gray-900">
                      {loan.loan_officer_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Disbursed</p>
                    <p className="font-medium text-gray-900">
                      {new Date(loan.disbursement_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* ✅ Fixed: nullish coalescing for pagination */}
              {(loans?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((loans?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((loans?.count || 0) / 10)}
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
