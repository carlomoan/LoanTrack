'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, User, Shield, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useMFI, useUpdateMFI, useUpdateUser } from '@/hooks/useSharedData';
import { useLogout } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { canEditMfi } from '@/lib/permissions';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('organization');

  const sections = [
    { id: 'organization', name: 'Organization', icon: Building2 },
    { id: 'profile', name: 'My Profile', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: Bell },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="space-y-1">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
              activeSection === section.id ? 'text-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {activeSection === section.id && (
              <motion.div
                layoutId="activeSettingsSection"
                className="absolute inset-0 bg-blue-50 rounded-lg"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <section.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{section.name}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-3 bg-white p-8 rounded-xl border border-gray-100 shadow-sm"
      >
        {activeSection === 'organization' && <OrganizationSection />}
        {activeSection === 'profile' && <ProfileSection />}
        {activeSection === 'security' && <SecuritySection />}
        {activeSection === 'notifications' && <NotificationsSection />}
      </motion.div>
    </div>
  );
}

// =============================================================================
// Organization
// =============================================================================
function OrganizationSection() {
  const user = useAuthStore((state) => state.user);
  const selectedMfi = useTenantContext((state) => state.selectedMfi);

  // Same target-resolution logic as the rest of the app: an MFI-role
  // account's own MFI always wins; a global-role account uses whichever
  // MFI they've entered via the tenant switcher.
  const targetMfiId = user?.mfi ?? selectedMfi?.id ?? null;
  const { data: mfi, isLoading } = useMFI(targetMfiId ?? 0);
  const updateMfi = useUpdateMFI();
  const canEdit = canEditMfi(user);

  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });

  useEffect(() => {
    if (mfi) {
      setForm({
        name: mfi.name ?? '',
        email: mfi.email ?? '',
        phone: mfi.phone ?? '',
        address: mfi.address ?? '',
      });
    }
  }, [mfi]);

  if (!targetMfiId) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900">Organization Details</h2>
        <p className="text-sm text-gray-500 mt-2">
          Select an MFI from the switcher in the header to view its organization details.
        </p>
      </div>
    );
  }

  if (isLoading || !mfi) {
    return <div className="animate-pulse text-sm text-gray-400">Loading...</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMfi.mutateAsync({ id: targetMfiId, data: form });
      toast.success('Organization details updated');
    } catch {
      toast.error('Failed to update organization details');
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Organization Details</h2>
        <p className="text-sm text-gray-500 mt-1">
          {canEdit
            ? "Update your MFI's registered information."
            : 'Your role has read-only access to this MFI\u2019s registration details.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">MFI Name</label>
          <Input
            value={form.name}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Contact Email</label>
          <Input
            type="email"
            value={form.email}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone</label>
          <Input
            value={form.phone}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Address</label>
          <Input
            value={form.address}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </div>
      {canEdit && (
        <Button type="submit" disabled={updateMfi.isPending}>
          {updateMfi.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </form>
  );
}

// =============================================================================
// Profile
// =============================================================================
function ProfileSection() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const updateUser = useUpdateUser();

  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const updated = await updateUser.mutateAsync({ id: user.id, data: form });
      setUser(updated);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your personal account settings.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Username</label>
          <Input value={user?.username ?? ''} disabled />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Role</label>
          <Input value={user?.role?.replace('_', ' ') ?? ''} disabled />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">First Name</label>
          <Input
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Last Name</label>
          <Input
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit" disabled={updateUser.isPending}>
        {updateUser.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}

// =============================================================================
// Security
// =============================================================================
function SecuritySection() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useUpdateUser();
  const logoutMutation = useLogout();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      // Note: this endpoint changes the password without verifying the
      // current one -- there's no "old password" check on the backend
      // today. That's fine for a user changing their own forgotten-ish
      // password while already logged in, but it does mean anyone who
      // gets hold of a valid session can lock the real owner out. Worth
      // adding current-password verification server-side before this
      // ships to real users.
      await updateUser.mutateAsync({
        id: user.id,
        data: { password: newPassword } as any,
      });
      toast.success('Password changed. Please sign in again.');
      setNewPassword('');
      setConfirmPassword('');
      await logoutMutation.mutateAsync();
      router.push('/login');
    } catch {
      toast.error('Failed to change password');
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Security</h2>
        <p className="text-sm text-gray-500 mt-1">
          Change your password. You&apos;ll be signed out afterward and need to sign back in.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={updateUser.isPending}>
        {updateUser.isPending ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}

// =============================================================================
// Notifications
// =============================================================================
function NotificationsSection() {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
      <p className="text-sm text-gray-500 mt-1">
        {"Notification preferences aren't implemented on the backend yet, so there's nothing real to configure here. Rather than show toggles that don't actually do anything, this section is intentionally left blank until that's built."}
      </p>
    </div>
  );
}
