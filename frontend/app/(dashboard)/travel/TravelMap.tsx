'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripResponse } from '@/types';

// 자산 경로 문제를 피하기 위해 divIcon으로 마커 생성 (여행/맛집 색상 구분)
function pinIcon(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);font-size:12px;line-height:1;">${emoji}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

const TRIP_ICON = pinIcon('#0f172a', '📍');
const RESTAURANT_ICON = pinIcon('#f97316', '🍽️');
const PENDING_ICON = pinIcon('#10b981', '➕');

type MarkerPoint = {
  key: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  kind: 'trip' | 'restaurant';
  tripId: number;
};

function FitBounds({ points }: { points: MarkerPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  // 초기 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function MapReadySignal({ onReady }: { onReady: (map: L.Map | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    return () => onReady(null);
  // map 인스턴스는 마운트 후 불변
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function MapEventHandler({
  addMode,
  onMapClick,
}: {
  addMode: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (addMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function TravelMap({
  trips,
  onSelectTrip,
  onMapReady,
  addRestaurantMode = false,
  onMapClick,
  pendingMarker = null,
}: {
  trips: TripResponse[];
  onSelectTrip: (id: number) => void;
  onMapReady?: (map: L.Map | null) => void;
  addRestaurantMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  pendingMarker?: { lat: number; lng: number } | null;
}) {
  const points = useMemo<MarkerPoint[]>(() => {
    const out: MarkerPoint[] = [];
    for (const t of trips) {
      if (t.latitude != null && t.longitude != null) {
        out.push({
          key: `trip-${t.id}`, lat: t.latitude, lng: t.longitude,
          title: t.name, subtitle: t.destination, kind: 'trip', tripId: t.id,
        });
      }
      for (const r of t.restaurants ?? []) {
        if (r.latitude != null && r.longitude != null) {
          out.push({
            key: `rest-${r.id}`, lat: r.latitude, lng: r.longitude,
            title: r.name, subtitle: `${t.name}${r.cuisine ? ` · ${r.cuisine}` : ''}`,
            kind: 'restaurant', tripId: t.id,
          });
        }
      }
    }
    return out;
  }, [trips]);

  const center: [number, number] = points.length > 0
    ? [points[0].lat, points[0].lng]
    : [36.5, 127.8]; // 대한민국 중심 기본값

  return (
    <div
      className="h-72 w-full rounded-2xl overflow-hidden border border-slate-100"
      style={{ cursor: addRestaurantMode ? 'crosshair' : undefined }}
    >
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.length > 0 && <FitBounds points={points} />}
        {onMapReady && <MapReadySignal onReady={onMapReady} />}
        <MapEventHandler addMode={addRestaurantMode} onMapClick={onMapClick} />
        {points.map(p => (
          <Marker
            key={p.key}
            position={[p.lat, p.lng]}
            icon={p.kind === 'trip' ? TRIP_ICON : RESTAURANT_ICON}
            eventHandlers={{ click: () => !addRestaurantMode && onSelectTrip(p.tripId) }}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>{p.kind === 'trip' ? '📍' : '🍽️'} {p.title}</strong>
                <br />
                <span style={{ color: '#64748b' }}>{p.subtitle}</span>
              </div>
            </Popup>
          </Marker>
        ))}
        {pendingMarker && (
          <Marker position={[pendingMarker.lat, pendingMarker.lng]} icon={PENDING_ICON}>
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>➕ 새 맛집 위치</strong>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
