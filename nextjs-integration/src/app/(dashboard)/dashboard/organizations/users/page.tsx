'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, UserCog } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUsers, useCreateUser } from '@/hooks/useSharedData';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { GlobalUser, UserRole } from '@/types';

// The roles an account can pick when creating a user are limited by their
// own role -- mirrors GlobalUserPermission on the backend (an MFI_ADMIN
// can only create staff at their own MFI, never another MFI_ADMIN).
const assignableRoles = (creatorRole?: UserRole): UserRole[] => {
  switch (creatorRole) {
    case 'SUPER_ADMIN':
      return ['SUPER_ADMIN', 'AOM_STAFF', 'DONOR_STAFF', 'MFI_ADMIN', 'MFI_MANAGER', 'LOAN_OFFICER'];
    case 'AOM_STAFF':
      return ['MFI_ADMIN', 'MFI_MANAGER', 'LOAN_OFFICER'];
    case 'MFI_ADMIN':
      return ['MFI_MANAGER', 'LOAN_OFFICER'];
    default:
      return [];
  }
};

export default function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: '' as UserRole | '',
  });

  const roles = assignableRoles(user?.role);

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.role) {
      toast.error('Username, password, and role are required');
      return;
    }
    try {
      await createUser.mutateAsync({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role as UserRole,
      });
      toast.success('User created');
      setForm({ username: '', email: '', password: '', role: '' });
      setShowForm(false);
    } catch {
      toast.error('Failed to create user — check the role is one you can assign.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500">
            Accounts visible here are scoped to your own organization.
          </p>
        </div>
        {roles.length > 0 && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" /> New User
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create a user</CardTitle>
            <CardDescription>They&apos;ll be created under your own organization automatically.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
            <div className="col-span-2">
              <Button size="sm" onClick={handleCreate} disabled={createUser.isPending}>
                {createUser.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : data?.results?.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">No users visible to your account.</div>
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((u: GlobalUser) => (
            <Card key={u.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{u.username}</p>
                    <p className="text-sm text-slate-500">
                      {u.mfi_name || u.aom_name || u.donor_name || 'No org'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.is_active ? 'success' : 'secondary'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{u.role.replace('_', ' ')}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
