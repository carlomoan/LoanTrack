// src/components/forms/MapAreaPicker.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { tenantApi } from '@/api/tenant';
import { showApiError } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';

export interface AreaSelection {
  lat: number;
  lng: number;
  region: { id: number; name: string } | null;
  district: { id: number; name: string } | null;
  ward: { id: number; name: string } | null;
  street: { id: number; name: string } | null;
}

export function MapAreaPicker({ value, onChange }: {
  value: AreaSelection | null;
  onChange: (v: AreaSelection | null) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);

  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [names, setNames] = useState({ region: '', district: '', ward: '', street: '' });
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([-6.7924, 39.2083], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setPoint({ lat, lng });
      marker.current?.remove();
      marker.current = L.circleMarker([lat, lng], { radius: 8, color: '#4f46e5', fillOpacity: 0.6 }).addTo(map);
      setDetecting(true);
      try {
        const { data } = await tenantApi.geocode.reverse(lat, lng);
        const nameOrNull = (v: string | { id: number; name: string } | null) =>
          typeof v === 'string' ? v : v?.name || '';
        setNames({
          region: nameOrNull(data.region as string | { id: number; name: string } | null),
          district: nameOrNull(data.district as string | { id: number; name: string } | null),
          ward: nameOrNull(data.ward as string | { id: number; name: string } | null),
          street: nameOrNull(data.street as string | { id: number; name: string } | null),
        });
      } catch (err) {
        showApiError(err, 'Reverse geocoding failed');
      } finally {
        setDetecting(false);
      }
    });

    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  const findOrCreate = async (
    list: (p: any) => Promise<any>,
    create: (d: any) => Promise<any>,
    name: string,
    extra: Record<string, any> = {}
  ) => {
    const res = await list({ search: name, page_size: 50 });
    const hit = res.data.results?.find((r: any) => r.name?.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
    const created = await create({
      name,
      code: name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'AREA',
      ...extra,
    });
    return created.data;
  };

  const confirm = async () => {
    if (!point) return;
    if (!names.region || !names.district || !names.ward || !names.street) {
      showApiError(null, 'All four area levels are required (edit detected names if needed)');
      return;
    }
    setBusy(true);
    try {
      const region = await findOrCreate(tenantApi.regions.list, tenantApi.regions.create, names.region);
      const district = await findOrCreate(tenantApi.districts.list, tenantApi.districts.create, names.district, { region: region.id });
      const ward = await findOrCreate(tenantApi.wards.list, tenantApi.wards.create, names.ward, { district: district.id, geo_type: 'URB' });
      const street = await findOrCreate(tenantApi.streets.list, tenantApi.streets.create, names.street, { ward: ward.id });
      onChange({
        lat: point.lat,
        lng: point.lng,
        region: { id: region.id, name: region.name },
        district: { id: district.id, name: district.name },
        ward: { id: ward.id, name: ward.name },
        street: { id: street.id, name: street.name },
      });
    } catch (err) {
      showApiError(err, 'Could not save area');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div ref={mapRef} className="h-56 rounded-lg border border-slate-200 z-0" />
      <div className="space-y-2">
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> Click the map — Django detects the area.
          {detecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </p>
        {(['region', 'district', 'ward', 'street'] as const).map((k) => (
          <Input
            key={k}
            placeholder={k[0].toUpperCase() + k.slice(1)}
            value={names[k]}
            onChange={(e) => setNames({ ...names, [k]: e.target.value })}
          />
        ))}
        <Button type="button" size="sm" onClick={confirm} disabled={busy || !point}>
          {busy ? 'Saving…' : 'Use this area'}
        </Button>
        {value?.street && (
          <p className="text-xs text-emerald-700">
            ✓ {value.street.name}, {value.ward?.name}, {value.district?.name}, {value.region?.name}
          </p>
        )}
      </div>
    </div>
  );
}
