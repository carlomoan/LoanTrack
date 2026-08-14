'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, User, Shield, Bell, MapPin, Plus, Edit, Trash2, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { sharedApi } from '@/api/shared';
import { useQuery } from '@tanstack/react-query';

const geoSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  parent_id: z.number().nullable().optional(),
  level: z.enum(['region', 'district', 'ward', 'street']),
});

type GeoFormData = z.infer<typeof geoSchema>;

const sections = [
  { id: 'organization', name: 'Organization', icon: Building2 },
  { id: 'profile', name: 'My Profile', icon: User },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'geolocation', name: 'Geolocation', icon: MapPin },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { hasPermission, role } = usePermissions();
  const [activeSection, setActiveSection] = useState('organization');
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const [editingGeo, setEditingGeo] = useState<any>(null);
  const [geoLevel, setGeoLevel] = useState<'region' | 'district' | 'ward' | 'street'>('region');
  const [parentId, setParentId] = useState<number | null>(null);

  // Fetch geolocation data based on level
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => sharedApi.regions.list().then(res => res.data.results),
    staleTime: 5 * 60 * 1000,
  });

  const { data: districts } = useQuery({
    queryKey: ['districts', parentId],
    queryFn: () => sharedApi.districts.list({ region: parentId }).then(res => res.data.results),
    enabled: !!parentId && geoLevel === 'district',
    staleTime: 5 * 60 * 1000,
  });

  const { data: wards } = useQuery({
    queryKey: ['wards', parentId],
    queryFn: () => sharedApi.wards.list({ district: parentId }).then(res => res.data.results),
    enabled: !!parentId && geoLevel === 'ward',
    staleTime: 5 * 60 * 1000,
  });

  const { data: streets } = useQuery({
    queryKey: ['streets', parentId],
    queryFn: () => sharedApi.streets.list({ ward: parentId }).then(res => res.data.results),
    enabled: !!parentId && geoLevel === 'street',
    staleTime: 5 * 60 * 1000,
  });

  const geoForm = useForm<GeoFormData>({
    resolver: zodResolver(geoSchema),
    defaultValues: {
      name: '',
      code: '',
      parent_id: null,
      level: 'region',
    },
  });

  const openGeoDialog = (level: 'region' | 'district' | 'ward' | 'street', item?: any) => {
    setGeoLevel(level);
    if (item) {
      setEditingGeo(item);
      geoForm.reset({
        name: item.name,
        code: item.code,
        parent_id: item.parent_id || item.region_id || item.district_id || item.ward_id || null,
        level: level,
      });
    } else {
      setEditingGeo(null);
      geoForm.reset({
        name: '',
        code: '',
        parent_id: parentId,
        level: level,
      });
    }
    setGeoDialogOpen(true);
  };

  const handleGeoSubmit = async (data: GeoFormData) => {
    try {
      const api = sharedApi[`${level}s` as keyof typeof sharedApi] as any;
      if (editingGeo) {
        await api.update(editingGeo.id, data);
        toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} updated!`);
      } else {
        await api.create(data);
        toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} created!`);
      }
      setGeoDialogOpen(false);
    } catch (error) {
      toast.error(`Failed to ${editingGeo ? 'update' : 'create'} ${level}`);
    }
  };

  const handleGeoDelete = async (level: string, id: number) => {
    if (!confirm(`Delete this ${level}?`)) return;
    try {
      const api = sharedApi[`${level}s` as keyof typeof sharedApi] as any;
      await api.delete(id);
      toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} deleted!`);
    } catch (error) {
      toast.error(`Failed to delete ${level}`);
    }
  };

  const renderGeoSection = () => {
    const levels = [
      { key: 'region', label: 'Regions', icon: Globe, data: regions, parentKey: null },
      { key: 'district', label: 'Districts', icon: MapPin, data: districts, parentKey: 'region' },
      { key: 'ward', label: 'Wards', icon: MapPin, data: wards, parentKey: 'district' },
      { key: 'street', label: 'Streets', icon: MapPin, data: streets, parentKey: 'ward' },
    ];

    return (
      <div className="space-y-6">
        {/* Level Selector */}
        <div className="flex gap-2 flex-wrap">
          {levels.map((level) => (
            <Button
              key={level.key}
              variant={geoLevel === level.key ? 'default' : 'outline'}
              onClick={() => {
                setGeoLevel(level.key as any);
                setParentId(null);
                setEditingGeo(null);
              }}
              disabled={level.key !== 'region' && !parentId}
            >
              {level.icon} {level.label}
            </Button>
          ))}
        </div>

        {/* Parent Selector for sub-levels */}
        {geoLevel !== 'region' && (
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Parent {geoLevel === 'district' ? 'Region' : geoLevel === 'ward' ? 'District' : 'Ward'}:
            </label>
            <Select value={parentId?.toString() || ''} onValueChange={(v) => setParentId(v ? Number(v) : null)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select parent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {levels.find(l => l.key === (geoLevel === 'district' ? 'region' : geoLevel === 'ward' ? 'district' : 'ward'))?.data?.map((item: any) => (
                  <SelectItem key={item.id} value={item.id.toString()}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => openGeoDialog(geoLevel)} disabled={!parentId}>
              <Plus className="h-4 w-4 mr-2" />
              Add {geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1)}
            </Button>
          </div>
        )}

        {/* Add button for region level */}
        {geoLevel === 'region' && (
          <Button onClick={() => openGeoDialog('region')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Region
          </Button>
        )}

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>{geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1)} Management</CardTitle>
          </CardHeader>
          <CardContent>
            {levels.find(l => l.key === geoLevel)?.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No {geoLevel}s found. Click "Add {geoLevel.charAt(0).toUpperCase() + geoLevel.slice(1)}" to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {levels.find(l => l.key === geoLevel)?.data?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">Code: {item.code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openGeoDialog(geoLevel, item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleGeoDelete(geoLevel, item.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

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
           </div>
        )}

        {activeSection === 'security' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">Security Settings</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">Manage password, 2FA, and session settings.</p>
          </div>
        )}

        {activeSection === 'notifications' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">Configure email and in-app notifications.</p>
          </div>
        )}

        {activeSection === 'geolocation' && (
          <renderGeoSection />
        )}
      </motion.div>
    </div>
  );
}