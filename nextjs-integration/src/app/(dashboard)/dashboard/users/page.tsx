'use client';

import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useUserRoles } from '@/hooks/useUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Shield } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import type { GlobalUser } from '@/types';

const userSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.string().min(1, 'Role is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  aom: z.number().nullable().optional(),
  donor: z.number().nullable().optional(),
  mfi: z.number().nullable().optional(),
  is_active: z.boolean().default(true),
  is_staff: z.boolean().default(false),
});

type UserFormData = z.infer<typeof userSchema>;

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  AOM_STAFF: 'AoM Staff',
  DONOR_STAFF: 'Donor Staff',
  MFI_ADMIN: 'MFI Admin',
  MFI_MANAGER: 'MFI Manager',
  LOAN_OFFICER: 'Loan Officer',
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<GlobalUser | null>(null);

  const { data: users, isLoading } = useUsers({
    page: page,
    page_size: 10,
    search: searchTerm || undefined,
    role: roleFilter || undefined,
  });

  const { data: roles } = useUserRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: '',
      password: '',
      aom: null,
      donor: null,
      mfi: null,
      is_active: true,
      is_staff: false,
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: '',
      password: '',
      aom: null,
      donor: null,
      mfi: null,
      is_active: true,
      is_staff: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (user: GlobalUser) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      password: '',
      aom: user.aom,
      donor: user.donor,
      mfi: user.mfi,
      is_active: user.is_active,
      is_staff: user.is_staff,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (data: UserFormData) => {
    try {
      const submitData = { ...data };
      if (!submitData.password) {
        delete submitData.password;
      }

      if (editingUser) {
        await updateUser.mutateAsync({ id: editingUser.id, data: submitData });
        toast.success('User updated successfully!');
      } else {
        await createUser.mutateAsync(submitData as UserFormData & { password: string });
        toast.success('User created successfully!');
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(editingUser ? 'Failed to update user' : 'Failed to create user');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser.mutateAsync(id);
      toast.success('User deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  // Check if current user can manage users
  const canManageUsers = hasPermission('users:write');

  if (!canManageUsers) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card className="text-center py-12">
          <CardContent>
            <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Access Denied</h3>
            <p className="text-slate-500 mt-2">You don't have permission to manage users.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage system users and their roles</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter users by role or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <Input
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users?.count || 0})</CardTitle>
          <CardDescription>All user accounts in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading users...</p>
            </div>
          ) : users?.results?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No users found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users?.results?.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{user.username}</p>
                    <p className="text-sm text-gray-500">{user.email} • {user.first_name} {user.last_name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Role</p>
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {roleLabels[user.role] || user.role}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">MFI</p>
                    <p className="font-medium text-gray-900">{user.mfi_name || 'N/A'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">AoM</p>
                    <p className="font-medium text-gray-900">{user.aom_name || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {(users?.results?.length ?? 0) > 0 && (
                <div className="flex justify-between items-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {page} of {Math.ceil((users?.count || 0) / 10)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil((users?.count || 0) / 10)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? `Update user: ${editingUser.username}`
                : 'Fill in the details below to create a new user account.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe" {...field} disabled={!!editingUser} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="aom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AoM</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} defaultValue={field.value?.toString() || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select AoM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {/* AoM options would be loaded from API */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="donor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Donor</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} defaultValue={field.value?.toString() || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Donor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {/* Donor options would be loaded from API */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mfi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MFI</FormLabel>
                      <Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} defaultValue={field.value?.toString() || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select MFI" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {/* MFI options would be loaded from API */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </FormControl>
                      <FormLabel>Active</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_staff"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </FormControl>
                      <FormLabel>Staff</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password {editingUser ? '(leave blank to keep current)' : ''}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={editingUser ? '••••••••' : 'Enter password'} {...field} />
                    </FormControl>
                    <FormDescription>
                      {editingUser ? 'Leave blank to keep current password' : 'Must be at least 8 characters'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}