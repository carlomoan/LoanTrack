// components/forms/LocationSelector.tsx
'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function LocationSelector({ onLocationChange }: { onLocationChange: (field: string, value: string) => void }) {
  const [regionId, setRegionId] = useState<string>('');
  const [districtId, setDistrictId] = useState<string>('');

  // Fetch Regions
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => api.get('/regions/').then(res => res.data),
  });

  // Fetch Districts based on selected Region
  const { data: districts } = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => api.get(`/districts/?region=${regionId}`).then(res => res.data),
    enabled: !!regionId, // Only run query if regionId is selected
  });

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm font-medium">Region</label>
        <Select onValueChange={(v) => { setRegionId(v); onLocationChange('region', v); }}>
          <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
          <SelectContent>
            {regions?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">District</label>
        <Select onValueChange={(v) => { setDistrictId(v); onLocationChange('district', v); }} disabled={!regionId}>
          <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
          <SelectContent>
            {districts?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
