'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, MapPin, ChevronRight, Map as MapIcon, List } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useRegions, useCreateRegion,
  useDistricts, useCreateDistrict,
  useWards, useCreateWard,
  useStreets, useCreateStreet,
} from '@/hooks/useTenantData';
import { useAuthStore } from '@/hooks/useAuthStore';
import { canWriteTenantData } from '@/lib/permissions';
import { LocationPickerMap } from '@/components/geography/LocationPickerMap';
import type { District, GeoType, Region, Street, Ward, GeocodeReverseResult } from '@/types';
import { GEO_TYPE_LABELS } from '@/types';

/**
 * The location hierarchy (Region -> District -> Ward -> Street) used
 * everywhere else in the app to place branches and members. This is
 * per-tenant data -- each MFI manages its own set, matching wherever it
 * actually operates.
 */
export default function GeographyPage() {
  const user = useAuthStore((state) => state.user);
  const canEdit = canWriteTenantData(user);
  const [mode, setMode] = useState<'browse' | 'map'>('map');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Geography</h1>
          <p className="text-slate-500">
            Regions, districts, wards, and streets used to place branches and members.
          </p>
        </div>
        {canEdit && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setMode('map')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${
                mode === 'map' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapIcon className="h-4 w-4" /> Add via Map
            </button>
            <button
              onClick={() => setMode('browse')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-slate-200 ${
                mode === 'browse' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="h-4 w-4" /> Browse / Add Manually
            </button>
          </div>
        )}
      </div>

      {mode === 'map' && canEdit && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <LocationPickerMap
              onResolved={(result: GeocodeReverseResult) => {
                if (result.region) {
                  toast.success(
                    `Saved: ${[result.region.name, result.district?.name, result.ward?.name, result.street?.name]
                      .filter(Boolean)
                      .join(' \u203a ')}`
                  );
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {mode === 'browse' && (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-slate-500 mb-4 flex-wrap">
            <button
              onClick={() => { setSelectedRegion(null); setSelectedDistrict(null); setSelectedWard(null); }}
              className={!selectedRegion ? 'font-medium text-slate-900' : 'hover:text-slate-700'}
            >
              Regions
            </button>
            {selectedRegion && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <button
                  onClick={() => { setSelectedDistrict(null); setSelectedWard(null); }}
                  className={!selectedDistrict ? 'font-medium text-slate-900' : 'hover:text-slate-700'}
                >
                  {selectedRegion.name}
                </button>
              </>
            )}
            {selectedDistrict && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <button
                  onClick={() => setSelectedWard(null)}
                  className={!selectedWard ? 'font-medium text-slate-900' : 'hover:text-slate-700'}
                >
                  {selectedDistrict.name}
                </button>
              </>
            )}
            {selectedWard && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-slate-900">{selectedWard.name}</span>
              </>
            )}
          </div>

          {!selectedRegion && (
            <RegionsList canEdit={canEdit} onSelect={setSelectedRegion} />
          )}
          {selectedRegion && !selectedDistrict && (
            <DistrictsList region={selectedRegion} canEdit={canEdit} onSelect={setSelectedDistrict} />
          )}
          {selectedDistrict && !selectedWard && (
            <WardsList district={selectedDistrict} canEdit={canEdit} onSelect={setSelectedWard} />
          )}
          {selectedWard && (
            <StreetsList ward={selectedWard} canEdit={canEdit} />
          )}
        </>
      )}
    </div>
  );
}

function AddRow({ onAdd, disabled, placeholder, extra }: {
  onAdd: (name: string, code: string) => Promise<void>;
  disabled: boolean;
  placeholder: string;
  extra?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  if (!disabled) return null;

  if (!show) {
    return (
      <Button size="sm" variant="outline" onClick={() => setShow(true)}>
        <Plus className="h-4 w-4 mr-1" /> Add {placeholder}
      </Button>
    );
  }

  return (
    <Card className="mb-3">
      <CardContent className="pt-6 flex flex-wrap items-center gap-3">
        <Input placeholder={`${placeholder} name`} value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Input placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[120px]" />
        {extra}
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            if (!name) { toast.error('Name is required'); return; }
            setSaving(true);
            try {
              await onAdd(name, code);
              setName(''); setCode(''); setShow(false);
            } catch (err: any) {
              // Surface the real backend error instead of a generic
              // message -- "Failed to save" with no detail is exactly
              // what made this class of bug hard to diagnose.
              const data = err?.response?.data;
              const detail =
                (typeof data === 'string' && data) ||
                data?.detail ||
                (data && typeof data === 'object'
                  ? Object.entries(data)
                      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                      .join(' | ')
                  : null) ||
                err?.message ||
                'Failed to save';
              toast.error(detail);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
      </CardContent>
    </Card>
  );
}

function RegionsList({ canEdit, onSelect }: { canEdit: boolean; onSelect: (r: Region) => void }) {
  const { data, isLoading } = useRegions();
  const createRegion = useCreateRegion();

  return (
    <div className="space-y-3">
      <AddRow
        disabled={canEdit}
        placeholder="Region"
        onAdd={async (name, code) => {
          await createRegion.mutateAsync(code ? { name, code } : { name });
          toast.success('Region added');
        }}
      />
      {isLoading ? <Loading /> : data?.results?.length === 0 ? <Empty label="No regions yet." /> : (
        data?.results?.map((r: Region) => (
          <Card key={r.id} className="cursor-pointer hover:border-violet-300" onClick={() => onSelect(r)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="font-medium text-slate-900">{r.name}</p>
              </div>
              <Badge variant="secondary">{r.district_count ?? 0} districts</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function DistrictsList({ region, canEdit, onSelect }: { region: Region; canEdit: boolean; onSelect: (d: District) => void }) {
  const { data, isLoading } = useDistricts({ region: region.id });
  const createDistrict = useCreateDistrict();

  return (
    <div className="space-y-3">
      <AddRow
        disabled={canEdit}
        placeholder="District"
        onAdd={async (name, code) => {
          await createDistrict.mutateAsync(code ? { name, code, region: region.id } : { name, region: region.id });
          toast.success('District added');
        }}
      />
      {isLoading ? <Loading /> : data?.results?.length === 0 ? <Empty label="No districts in this region yet." /> : (
        data?.results?.map((d: District) => (
          <Card key={d.id} className="cursor-pointer hover:border-violet-300" onClick={() => onSelect(d)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="font-medium text-slate-900">{d.name}</p>
              </div>
              <Badge variant="secondary">{d.ward_count ?? 0} wards</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function WardsList({ district, canEdit, onSelect }: { district: District; canEdit: boolean; onSelect: (w: Ward) => void }) {
  const { data, isLoading } = useWards({ district: district.id });
  const createWard = useCreateWard();
  // Bug fix: these must match the backend's actual GeoType choices
  // (URB/RUR/PER) -- the previous version sent 'URBAN'/'RURAL'/
  // 'PERI_URBAN', which the backend's ChoiceField validation rejected
  // outright, silently breaking every Ward creation.
  const [geoType, setGeoType] = useState<GeoType>('URB');

  return (
    <div className="space-y-3">
      <AddRow
        disabled={canEdit}
        placeholder="Ward"
        extra={
          <select
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            value={geoType}
            onChange={(e) => setGeoType(e.target.value as GeoType)}
          >
            {(Object.keys(GEO_TYPE_LABELS) as GeoType[]).map((key) => (
              <option key={key} value={key}>{GEO_TYPE_LABELS[key]}</option>
            ))}
          </select>
        }
        onAdd={async (name, code) => {
          await createWard.mutateAsync(
            code
              ? { name, code, district: district.id, geo_type: geoType }
              : { name, district: district.id, geo_type: geoType }
          );
          toast.success('Ward added');
        }}
      />
      {isLoading ? <Loading /> : data?.results?.length === 0 ? <Empty label="No wards in this district yet." /> : (
        data?.results?.map((w: Ward) => (
          <Card key={w.id} className="cursor-pointer hover:border-violet-300" onClick={() => onSelect(w)}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="font-medium text-slate-900">{w.name}</p>
                <Badge variant="outline">{GEO_TYPE_LABELS[w.geo_type as GeoType] ?? w.geo_type}</Badge>
              </div>
              <Badge variant="secondary">{w.street_count ?? 0} streets</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function StreetsList({ ward, canEdit }: { ward: Ward; canEdit: boolean }) {
  const { data, isLoading } = useStreets({ ward: ward.id });
  const createStreet = useCreateStreet();

  return (
    <div className="space-y-3">
      <AddRow
        disabled={canEdit}
        placeholder="Street"
        onAdd={async (name, code) => {
          await createStreet.mutateAsync(code ? { name, code, ward: ward.id } : { name, ward: ward.id });
          toast.success('Street added');
        }}
      />
      {isLoading ? <Loading /> : data?.results?.length === 0 ? <Empty label="No streets in this ward yet." /> : (
        data?.results?.map((s: Street) => (
          <Card key={s.id}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="font-medium text-slate-900">{s.name}</p>
              </div>
              <Badge variant="secondary">{s.member_count ?? 0} members</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-8 text-sm text-slate-500">{label}</div>;
}
