'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet's default marker icons reference image files via paths that
// don't resolve correctly through Next.js's bundler -- this is the
// standard fix, pointing them at a CDN instead of the (broken) bundled
// path.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Rough center of Tanzania -- a reasonable default view before the user
// clicks anywhere.
const DEFAULT_CENTER: [number, number] = [-6.369, 34.888];
const DEFAULT_ZOOM = 6;

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LeafletMapInner({
  onLocationClick,
  markerPosition,
}: {
  onLocationClick: (lat: number, lng: number) => void;
  markerPosition: { lat: number; lng: number } | null;
}) {
  const [center] = useState<[number, number]>(DEFAULT_CENTER);

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onLocationClick} />
      {markerPosition && (
        <Marker
          position={[markerPosition.lat, markerPosition.lng]}
          icon={markerIcon}
        />
      )}
    </MapContainer>
  );
}
