'use client';

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const PICK_ICON = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#0f172a;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number } | null) => void;
}) {
  const initialCenter: [number, number] = value ? [value.lat, value.lng] : [36.5, 127.8];
  const initialZoom = value ? 11 : 5;

  return (
    <div>
      <div
        className="h-48 w-full rounded-xl overflow-hidden border border-slate-200"
        style={{ cursor: 'crosshair' }}
      >
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPick={(lat, lng) => onChange({ lat, lng })} />
          {value && <Marker position={[value.lat, value.lng]} icon={PICK_ICON} />}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        {value ? (
          <span className="font-mono text-slate-500">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-slate-400">지도를 클릭하면 위치가 선택됩니다</span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            위치 지우기
          </button>
        )}
      </div>
    </div>
  );
}
