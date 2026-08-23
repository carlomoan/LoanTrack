'use client';

import { useState } from 'react';
import { useLoanOfficers } from '@/hooks/useLoanOfficers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function LoanOfficersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: loanOfficers, isLoading } = useLoanOfficers({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    branch: branchFilter || undefined,
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loan Officers Management</h1>
        <p className="text-gray-600">Manage all loan officers and their assignments</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter loan officers by branch or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by name or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="1">Head Office</SelectItem>
                  <SelectItem value="2">Branch A</SelectItem>
                  <SelectItem value="3">Branch B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setBranchFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Officers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Officers ({loanOfficers?.count || 0})</CardTitle>
          <CardDescription>All loan officers in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading loan officers...</p>
            </div>
          ) : loanOfficers?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No loan officers found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {loanOfficers?.results?.map((officer) => (
                <div key={officer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{officer.name}</p>
                    <p className="text-sm text-gray-500">ID: {officer.employee_id || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Branch</p>
                    <p className="font-medium text-gray-900">
                      {officer.branch_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">
                      {officer.phone || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">
                      {officer.email || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${officer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {officer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Members</p>
                    <p className="font-medium text-gray-900">
                      {officer.member_count || 0}
                    </p>
                  </div>
                </div>
              ))}
              {(loanOfficers?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((loanOfficers?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((loanOfficers?.count || 0) / 10)}
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
