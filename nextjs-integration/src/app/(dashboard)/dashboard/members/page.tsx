'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMembers, useDeleteMember } from '@/hooks/useMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAuthStore } from '@/hooks/useAuthStore';
import { showApiError } from '@/lib/api-errors';
import { canWriteTenantData, canDeleteTenantData } from '@/lib/permissions';

export default function MembersPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canWrite = canWriteTenantData(user);
  const canDelete = canDeleteTenantData(user);
  const deleteMember = useDeleteMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this member? This cannot be undone.')) return;
    try {
      await deleteMember.mutateAsync(id);
      toast.success('Member deleted');
    } catch (e) {
      showApiError(e, 'Failed to delete member');
    }
  };

  const { data: members, isLoading } = useMembers({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    gender: genderFilter || undefined,
  });

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members Management</h1>
          <p className="text-gray-600">Manage all borrowers and members in the system</p>
        </div>
        {canWrite && (
          <Button onClick={() => router.push('/dashboard/members/new')}>
            <Plus className="h-4 w-4 mr-1" /> New Member
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter members by gender or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <Input
                placeholder="Search by name or member ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All genders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="O">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setGenderFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members?.count || 0})</CardTitle>
          <CardDescription>All member records in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading members...</p>
            </div>
          ) : members?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No members found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members?.results?.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-500">ID: {member.member_id}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Gender</p>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {member.gender}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium text-gray-900">
                      {member.borrower_type === 'IND' ? 'Individual' : 'Group'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Branch</p>
                    <p className="font-medium text-gray-900">
                      {member.branch_name || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Loans</p>
                    <p className="font-medium text-gray-900">
                      {member.loan_count || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Joined</p>
                    <p className="font-medium text-gray-900">
                      {member.joined_date ? new Date(member.joined_date).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  {/* Role-gated row actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="View loans"
                      onClick={() => router.push(`/dashboard/loans?member=${member.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete member"
                        onClick={() => handleDelete(member.id)}
                        disabled={deleteMember.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(members?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((members?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((members?.count || 0) / 10)}
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
