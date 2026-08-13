'use client';

import { useState } from 'react';
import { useBranches } from '@/hooks/useBranches';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function BranchesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: branches, isLoading } = useBranches({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    region: regionFilter || undefined,
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Branches Management</h1>
        <p className="text-gray-600">Manage all MFI branches and locations</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter branches by region or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by branch name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region
              </label>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="1">North</SelectItem>
                  <SelectItem value="2">South</SelectItem>
                  <SelectItem value="3">East</SelectItem>
                  <SelectItem value="4">West</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setRegionFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Branches ({branches?.count || 0})</CardTitle>
          <CardDescription>All branch locations in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading branches...</p>
            </div>
          ) : branches?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No branches found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {branches?.results?.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{branch.name}</p>
                    <p className="text-sm text-gray-500">Code: {branch.code}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Street</p>
                    <p className="font-medium text-gray-900">{branch.street_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Ward</p>
                    <p className="font-medium text-gray-900">{branch.ward_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">District</p>
                    <p className="font-medium text-gray-900">{branch.district_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Region</p>
                    <p className="font-medium text-gray-900">{branch.region_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Loan Officers</p>
                    <p className="font-medium text-gray-900">
                      {branch.loan_officer_count || 0}
                    </p>
                  </div>
                </div>
              ))}
              {(branches?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((branches?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((branches?.count || 0) / 10)}
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
