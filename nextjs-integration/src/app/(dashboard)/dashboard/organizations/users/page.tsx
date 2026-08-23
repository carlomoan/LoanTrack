'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, UserCog, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useMFIs } from '@/hooks/useSharedData';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { GlobalUser, MFI, UserRole } from '@/types';

// The roles an account can pick when creating/editing a user are limited
// by their own role -- mirrors GlobalUserSerializer.ASSIGNABLE_ROLES on
// the backend, which is the actual security boundary. This list is UI
// convenience only: the backend rejects anything outside it regardless
// of what the frontend sends.
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

// AOM_STAFF and MFI_ADMIN must delegate within their own MFI/AoM -- the
// backend rejects a role assignment from these creators with no MFI, or
// one outside their scope. SUPER_ADMIN can optionally set one; DONOR_STAFF
// and AOM_STAFF-level (peer) accounts don't have an MFI at all.
const requiresMfiSelection = (creatorRole?: UserRole, targetRole?: UserRole) =>
  creatorRole === 'AOM_STAFF' ||
  creatorRole === 'MFI_ADMIN' ||
  (creatorRole === 'SUPER_ADMIN' && ['MFI_ADMIN', 'MFI_MANAGER', 'LOAN_OFFICER'].includes(targetRole ?? ''));

export default function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { data: mfis } = useMFIs();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: '' as UserRole | '', mfiId: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ role: '' as UserRole | '', mfiId: '', is_active: true });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const roles = assignableRoles(user?.role);
  const needsMfi = requiresMfiSelection(user?.role, form.role || undefined);
  // MFI_ADMIN always delegates within their own MFI -- no choice to make.
  const mfiChoices = user?.role === 'MFI_ADMIN' && user.mfi
    ? mfis?.results?.filter((m: MFI) => m.id === user.mfi)
    : mfis?.results;

  const resetCreateForm = () => {
    setForm({ username: '', email: '', password: '', role: '', mfiId: '' });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!form.username || !form.password || !form.role) {
      toast.error('Username, password, and role are required');
      return;
    }
    if (needsMfi && !form.mfiId) {
      toast.error('An MFI must be selected for this role');
      return;
    }
    try {
      await createUser.mutateAsync({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role as UserRole,
        mfi: form.mfiId ? Number(form.mfiId) : null,
      });
      toast.success('User created');
      resetCreateForm();
    } catch {
      toast.error('Failed to create user — check the role and MFI are ones you can assign.');
    }
  };

  const startEdit = (target: GlobalUser) => {
    setEditingId(target.id);
    setEditForm({
      role: target.role,
      mfiId: target.mfi ? String(target.mfi) : '',
      is_active: target.is_active,
    });
  };

  const handleSaveEdit = async (target: GlobalUser) => {
    try {
      await updateUser.mutateAsync({
        id: target.id,
        data: {
          role: editForm.role as UserRole,
          mfi: editForm.mfiId ? Number(editForm.mfiId) : null,
          is_active: editForm.is_active,
        },
      });
      toast.success('User updated');
      setEditingId(null);
    } catch {
      toast.error('Failed to update user — check the role and MFI are within your scope.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser.mutateAsync(id);
      toast.success('User removed');
      setConfirmDeleteId(null);
    } catch {
      toast.error('Failed to remove user');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500">
            Accounts visible here are scoped to your own organization. You
            can only assign roles and MFIs within what you&apos;re authorized to manage.
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
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, mfiId: '' })}
            >
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
            {needsMfi && (
              <select
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg col-span-2"
                value={form.mfiId}
                onChange={(e) => setForm({ ...form, mfiId: e.target.value })}
              >
                <option value="">Select MFI</option>
                {mfiChoices?.map((m: MFI) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
        </div>
      ) : data?.results?.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">No users visible to your account.</div>
      ) : (
        <div className="grid gap-3">
          {data?.results?.map((u: GlobalUser) => {
            const isSelf = u.id === user?.id;
            const isEditing = editingId === u.id;

            return (
              <Card key={u.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold">
                        <UserCog className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {u.username} {isSelf && <span className="text-xs text-slate-400">(you)</span>}
                        </p>
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
                      {!isSelf && !isEditing && roles.length > 0 && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 items-end">
                      <select
                        className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      >
                        {assignableRoles(user?.role).includes(u.role) && (
                          <option value={u.role}>{u.role.replace('_', ' ')}</option>
                        )}
                        {assignableRoles(user?.role)
                          .filter((r) => r !== u.role)
                          .map((r) => (
                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                          ))}
                      </select>
                      {requiresMfiSelection(user?.role, editForm.role || undefined) && (
                        <select
                          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                          value={editForm.mfiId}
                          onChange={(e) => setEditForm({ ...editForm, mfiId: e.target.value })}
                        >
                          <option value="">Select MFI</option>
                          {mfiChoices?.map((m: MFI) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(u)} disabled={updateUser.isPending}>
                          {updateUser.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {confirmDeleteId === u.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between bg-red-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
                      <p className="text-sm text-red-700">Remove {u.username}? This can&apos;t be undone.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(u.id)}
                          disabled={deleteUser.isPending}
                        >
                          {deleteUser.isPending ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
