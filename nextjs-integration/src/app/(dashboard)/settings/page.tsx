'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, User, Shield, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
      {/* Sidebar Navigation */}
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

      {/* Content Area */}
      <motion.div
        key={activeSection}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="md:col-span-3 bg-white p-8 rounded-xl border border-gray-100 shadow-sm"
      >
        {activeSection === 'organization' && (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); toast.success('Organization updated!'); }}>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Organization Details</h2>
              <p className="text-sm text-gray-500 mt-1">Update your MFI's registered information.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">MFI Name</label>
                <Input defaultValue="Andrew Bio TAMFI" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Contact Email</label>
                <Input type="email" defaultValue="admin@andrewbio.com" />
              </div>
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
          </form>
        )}

        {activeSection === 'profile' && (
           <div>
             <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
             <p className="text-sm text-gray-500 mt-1 mb-6">Manage your personal account settings.</p>
             {/* Profile fields here */}
           </div>
        )}

        {/* Add other sections (security, notifications) similarly */}
      </motion.div>
    </div>
  );
}
