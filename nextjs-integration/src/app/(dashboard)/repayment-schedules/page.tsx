'use client';

import { useState } from 'react';
import { useRepaymentSchedules, useOverdueSchedules } from '@/hooks/useRepaymentSchedules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function RepaymentSchedulesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: schedules, isLoading } = useRepaymentSchedules({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    status: statusFilter || undefined,
  });

  const { data: overdueSchedules } = useOverdueSchedules();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repayment Schedules</h1>
          <p className="text-gray-600">Manage loan repayment schedules and track overdue payments</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Overdue Schedules</p>
          <p className="text-2xl font-bold text-red-600">
            {overdueSchedules?.count || 0}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules?.count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schedules?.results?.filter(s => s.is_paid).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {overdueSchedules?.count || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${schedules?.results?.reduce((sum, s) => sum + parseFloat(s.expected_total || '0'), 0).toLocaleString() || '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter schedules by status or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by loan number or member name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
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

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Repayment Schedules ({schedules?.count || 0})</CardTitle>
          <CardDescription>All repayment schedules in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading schedules...</p>
            </div>
          ) : schedules?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No schedules found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules?.results?.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Loan #{schedule.loan_number} - Installment {schedule.installment_number}
                    </p>
                    <p className="text-sm text-gray-500">{schedule.member_name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Due Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(schedule.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Expected Total</p>
                    <p className="font-medium text-gray-900">
                      ${parseFloat(schedule.expected_total || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Actual Paid</p>
                    <p className="font-medium text-gray-900">
                      ${parseFloat(schedule.actual_paid || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${schedule.is_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {schedule.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Days Overdue</p>
                    <p className={`font-medium ${schedule.days_overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {schedule.days_overdue}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Remaining</p>
                    <p className="font-medium text-gray-900">
                      ${Number(schedule.remaining_amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {(schedules?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((schedules?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((schedules?.count || 0) / 10)}
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