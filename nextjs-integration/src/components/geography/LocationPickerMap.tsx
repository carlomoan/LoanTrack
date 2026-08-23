'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { MapPin, Loader2 } from 'lucide-react';
import { tenantApi } from '@/api/tenant';
import type { GeocodeReverseResult } from '@/types';

// Leaflet touches window/document at import time, which breaks Next.js's
// server render -- load the actual map client-side only.
const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-lg">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  ),
});

/**
 * Click a point on the map -> reverse-geocode it via the backend (which
 * calls OpenStreetMap Nominatim and get_or_creates the matching Region/
 * District/Ward/Street for this tenant) -> show what was resolved.
 *
 * onResolved fires once per successful lookup with the full result,
 * including ids -- the parent (a Branch or Member form, or this page's
 * own "confirm" step) decides what to do with it.
 */
export function LocationPickerMap({
  onResolved,
  height = 400,
}: {
  onResolved?: (result: GeocodeReverseResult) => void;
  height?: number;
}) {
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<GeocodeReverseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (lat: number, lng: number) => {
    setMarker({ lat, lng });
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const response = await tenantApi.geocode.reverse(lat, lng);
      setResult(response.data);
      onResolved?.(response.data);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        'Could not resolve this location. Try clicking somewhere else.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg overflow-hidden border border-slate-200"
        style={{ height }}
      >
        <LeafletMapInner onLocationClick={handleClick} markerPosition={marker} />
      </div>

      <p className="text-xs text-slate-400">
        Click anywhere on the map to look up its region, district, ward, and street.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking up this location...
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {result && !loading && !error && (
        <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-sm">
          <div className="flex items-center gap-1.5 text-violet-700 font-medium mb-1">
            <MapPin className="h-4 w-4" /> Resolved location
          </div>
          <p className="text-slate-600">{result.display_name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-slate-700">
            <span><strong>Region:</strong> {result.region?.name ?? '—'}</span>
            <span><strong>District:</strong> {result.district?.name ?? '—'}</span>
            <span><strong>Ward:</strong> {result.ward?.name ?? '—'}</span>
            <span><strong>Street:</strong> {result.street?.name ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
