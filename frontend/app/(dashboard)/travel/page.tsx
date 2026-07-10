'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import dynamic from 'next/dynamic';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import {
  Plane,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  AlertCircle,
  Clock,
  ListOrdered,
  Download,
  Loader2,
  Utensils,
  Map as MapIcon,
  RefreshCw,
} from 'lucide-react';
import { travelApi, exportApi } from '@/lib/api';
import { showToast } from '@/lib/toast';
import type {
  TripResponse,
  TripStatus,
  ChecklistItemResponse,
  TripPlanItemResponse,
} from '@/types';

// 지도는 Leaflet 기반 — window 의존성 때문에 클라이언트에서만 로드 (SSR 비활성)
const TravelMap = dynamic(() => import('./TravelMap'), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-slate-300" />
    </div>
  ),
});

const LocationPickerMap = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center">
      <Loader2 size={16} className="animate-spin text-slate-300" />
    </div>
  ),
});

// ── 상태 배지 ──────────────────────────────────────────────
const STATUS_META: Record<TripStatus, { label: string; cls: string }> = {
  planned: { label: '예정', cls: 'bg-blue-100 text-blue-700' },
  ongoing: { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: '완료', cls: 'bg-slate-100 text-slate-500' },
};

function StatusBadge({ status }: { status: TripStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

// ── 날짜 유틸 ──────────────────────────────────────────────
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const nights = Math.round((e.getTime() - s.getTime()) / 86400000);
  return `${formatDate(start)} – ${formatDate(end)} (${nights}박 ${nights + 1}일)`;
}
function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}
function getDDay(startDate: string, status: TripStatus): { label: string; cls: string } | null {
  if (status === 'completed') return null;
  if (status === 'ongoing') return { label: '여행 중', cls: 'bg-emerald-100 text-emerald-700' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { label: 'D-Day', cls: 'bg-red-100 text-red-600' };
  if (diff < 0) return null;
  return {
    label: `D-${diff}`,
    cls: diff <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600',
  };
}

// ── 체크리스트 행 ──────────────────────────────────────────
function ChecklistRow({
  item,
  onToggle,
  onDelete,
  toggleDisabled = false,
  deleteDisabled = false,
}: {
  item: ChecklistItemResponse;
  onToggle: () => void;
  onDelete: () => void;
  toggleDisabled?: boolean;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={onToggle}
        disabled={toggleDisabled}
        className="text-slate-400 hover:text-slate-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {item.is_checked ? (
          <CheckSquare size={16} className="text-slate-700" />
        ) : (
          <Square size={16} />
        )}
      </button>
      <span
        className={`flex-1 text-sm ${item.is_checked ? 'line-through text-slate-400' : 'text-slate-700'}`}
      >
        {item.text}
      </span>
      <button
        onClick={onDelete}
        disabled={deleteDisabled}
        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── 여행 추가 폼 ───────────────────────────────────────────
interface AddTripFormProps {
  onSave: (data: {
    name: string;
    destination: string;
    start_date: string;
    end_date: string;
    status: TripStatus;
    note: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
  }) => Promise<void>;
  onCancel: () => void;
}

function AddTripForm({ onSave, onCancel }: AddTripFormProps) {
  const today = toISODate(new Date());
  const [name, setName] = useState('');
  const [dest, setDest] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState<TripStatus>('planned');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState('');
  const [pickedLoc, setPickedLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !dest.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        destination: dest.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
        note: note.trim(),
        address: address.trim(),
        ...(pickedLoc ? { latitude: pickedLoc.lat, longitude: pickedLoc.lng } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <p className="text-sm font-semibold text-slate-700 mb-1">새 여행 추가</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">여행 이름 *</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 도쿄 여행"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">목적지 *</label>
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="예: 일본 도쿄"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">출발일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              const newStart = e.target.value;
              setStartDate(newStart);
              if (endDate < newStart) setEndDate(newStart);
            }}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">귀국일</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">상태</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TripStatus)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          >
            <option value="planned">예정</option>
            <option value="ongoing">진행중</option>
            <option value="completed">완료</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">메모</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="간단한 메모 (선택)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="col-span-2 space-y-2">
          <label className="text-xs text-slate-500 mb-1 block">위치 (지도 표시용, 선택)</label>
          <div className="flex gap-2">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="주소·장소명 입력 시 지도에 표시돼요 (예: 도쿄 신주쿠)"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              title="지도에서 직접 위치 선택"
              className={`shrink-0 px-3 py-2 text-xs rounded-xl border transition-colors ${
                showPicker || pickedLoc
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <MapPin size={14} className="inline mr-1" />
              {pickedLoc ? '선택됨' : '지도선택'}
            </button>
          </div>
          {showPicker && (
            <LocationPickerMap
              value={pickedLoc}
              onChange={(v) => {
                setPickedLoc(v);
                if (!v) setShowPicker(false);
              }}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim() || !dest.trim()}
          className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ── 여행 카드 ──────────────────────────────────────────────
interface TripCardProps {
  trip: TripResponse;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<TripResponse>) => void;
  onToggleChecklist: (tripId: number, itemId: number) => void;
  onDeleteChecklist: (tripId: number, itemId: number) => void;
  onAddChecklist: (tripId: number, text: string) => void;
  onAddPlanItem: (
    tripId: number,
    data: { day: number; title: string; time?: string; description?: string },
  ) => void;
  onUpdatePlanItem: (
    tripId: number,
    itemId: number,
    data: Partial<{ title: string; time: string | null; description: string | null; day: number }>,
  ) => void;
  onDeletePlanItem: (tripId: number, itemId: number) => void;
  onAddRestaurant: (
    tripId: number,
    data: {
      name: string;
      address?: string;
      cuisine?: string;
      note?: string;
      latitude?: number | null;
      longitude?: number | null;
    },
  ) => void;
  onUpdateRestaurant: (
    tripId: number,
    restaurantId: number,
    data: Partial<{ is_visited: boolean; note: string | null }>,
  ) => void;
  onDeleteRestaurant: (tripId: number, restaurantId: number) => void;
  onShowOnMap: (tripId: number) => void;
  onAddRestaurantOnMap: (tripId: number) => void;
  mutatingKeys: Set<string>;
}

function TripCard({
  trip,
  expanded,
  onToggleExpand,
  onDelete,
  onUpdate,
  onToggleChecklist,
  onDeleteChecklist,
  onAddChecklist,
  onAddPlanItem,
  onUpdatePlanItem,
  onDeletePlanItem,
  onAddRestaurant,
  onUpdateRestaurant,
  onDeleteRestaurant,
  onShowOnMap,
  onAddRestaurantOnMap,
  mutatingKeys,
}: TripCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(trip.name);
  const [editDest, setEditDest] = useState(trip.destination);
  const [editStatus, setEditStatus] = useState<TripStatus>(trip.status as TripStatus);
  const [editNote, setEditNote] = useState(trip.note ?? '');
  const [editStartDate, setEditStartDate] = useState(trip.start_date);
  const [editEndDate, setEditEndDate] = useState(trip.end_date);
  const [editAddress, setEditAddress] = useState(trip.address ?? '');
  const [editPickedLoc, setEditPickedLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [checkText, setCheckText] = useState('');
  const [activeTab, setActiveTab] = useState<'checklist' | 'plan' | 'restaurant'>('checklist');
  const [planDay, setPlanDay] = useState(1);
  const [planTime, setPlanTime] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [editingPlan, setEditingPlan] = useState<{
    id: number;
    day: number;
    title: string;
    time: string;
    description: string;
  } | null>(null);
  const [restName, setRestName] = useState('');
  const [restAddress, setRestAddress] = useState('');
  const [restCuisine, setRestCuisine] = useState('');
  const [restPickedLoc, setRestPickedLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function askDeleteTrip() {
    setDeletePending(true);
    deleteTimerRef.current = setTimeout(() => setDeletePending(false), 3000);
  }

  function cancelDeleteTrip() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletePending(false);
  }

  function confirmDeleteTrip() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeletePending(false);
    onDelete(trip.id);
  }

  const handleAddRestaurant = () => {
    if (!restName.trim()) return;
    onAddRestaurant(trip.id, {
      name: restName.trim(),
      address: restAddress.trim() || undefined,
      cuisine: restCuisine.trim() || undefined,
      ...(restPickedLoc ? { latitude: restPickedLoc.lat, longitude: restPickedLoc.lng } : {}),
    });
    setRestName('');
    setRestAddress('');
    setRestCuisine('');
    setRestPickedLoc(null);
    setShowRestPicker(false);
  };

  const checked = trip.checklist_items.filter((i) => i.is_checked).length;
  const total = trip.checklist_items.length;

  const tripDays = Math.max(
    1,
    Math.round(
      (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000,
    ) + 1,
  );

  const planByDay = (trip.plan_items ?? []).reduce(
    (acc, item) => {
      if (!acc[item.day]) acc[item.day] = [];
      acc[item.day].push(item);
      return acc;
    },
    {} as Record<number, TripPlanItemResponse[]>,
  );

  const handleAddPlan = () => {
    if (!planTitle.trim()) return;
    onAddPlanItem(trip.id, {
      day: planDay,
      title: planTitle.trim(),
      time: planTime || undefined,
      description: planDesc.trim() || undefined,
    });
    setPlanTitle('');
    setPlanTime('');
    setPlanDesc('');
  };

  const startEditing = () => {
    setEditPickedLoc(
      trip.latitude != null && trip.longitude != null
        ? { lat: trip.latitude, lng: trip.longitude }
        : null,
    );
    setShowEditPicker(false);
    setEditing(true);
  };

  const saveEdit = () => {
    const nextAddress = editAddress.trim();
    const addressChanged = nextAddress !== (trip.address ?? '');

    let locationPayload: Partial<TripResponse> = {};
    if (editPickedLoc !== null) {
      // 지도에서 명시적으로 선택한 좌표 → 지오코딩보다 우선
      locationPayload = {
        latitude: editPickedLoc.lat,
        longitude: editPickedLoc.lng,
      } as Partial<TripResponse>;
      if (addressChanged)
        (locationPayload as Record<string, unknown>).address = nextAddress || null;
    } else if (addressChanged) {
      // 좌표 선택 없이 주소만 변경 → 백엔드가 지오코딩으로 좌표 갱신.
      // 주소를 비우면 좌표도 함께 비운다.
      locationPayload = nextAddress
        ? ({ address: nextAddress } as Partial<TripResponse>)
        : ({ address: null, latitude: null, longitude: null } as Partial<TripResponse>);
    }

    onUpdate(trip.id, {
      name: editName.trim() || trip.name,
      destination: editDest.trim() || trip.destination,
      status: editStatus,
      note: editNote.trim() || null,
      start_date: editStartDate,
      end_date: editEndDate,
      ...locationPayload,
    } as Partial<TripResponse>);
    setEditing(false);
  };

  const handleAddChecklist = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && checkText.trim()) {
      onAddChecklist(trip.id, checkText.trim());
      setCheckText('');
    }
  };

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* 카드 헤더 */}
      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="여행 이름"
                autoFocus
              />
              <input
                value={editDest}
                onChange={(e) => setEditDest(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="목적지"
              />
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TripStatus)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="planned">예정</option>
                <option value="ongoing">진행중</option>
                <option value="completed">완료</option>
              </select>
              <input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="메모 (선택)"
              />
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditStartDate(v);
                  if (v > editEndDate) setEditEndDate(v);
                }}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <input
                type="date"
                value={editEndDate}
                min={editStartDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <div className="col-span-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="위치 (지도 표시용, 선택)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPicker((v) => !v)}
                    title="지도에서 직접 위치 선택"
                    className={`shrink-0 px-2.5 py-1.5 text-xs rounded-xl border transition-colors ${
                      showEditPicker || editPickedLoc
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={13} className="inline mr-0.5" />
                    {editPickedLoc ? '선택됨' : '지도'}
                  </button>
                </div>
                {showEditPicker && (
                  <LocationPickerMap
                    value={editPickedLoc}
                    onChange={(v) => {
                      setEditPickedLoc(v);
                      if (!v) {
                        setEditAddress('');
                        setShowEditPicker(false);
                      }
                    }}
                  />
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                aria-label="편집 취소"
                disabled={mutatingKeys.has(`trip_update_${trip.id}`)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-40"
              >
                <X size={15} />
              </button>
              <button
                onClick={saveEdit}
                aria-label="여행 저장"
                disabled={mutatingKeys.has(`trip_update_${trip.id}`)}
                className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {mutatingKeys.has(`trip_update_${trip.id}`) ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <StatusBadge status={trip.status as TripStatus} />
                {(() => {
                  const dd = getDDay(trip.start_date, trip.status as TripStatus);
                  return dd ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${dd.cls}`}
                    >
                      {dd.label}
                    </span>
                  ) : null;
                })()}
                <h3 className="font-bold text-slate-800 truncate">{trip.name}</h3>
              </div>
              <div className="flex items-center gap-1 text-slate-500 text-sm mb-1">
                <MapPin size={13} className="shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Calendar size={12} className="shrink-0" />
                <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
              </div>
              {trip.note && (
                <p className="text-slate-400 text-xs mt-1.5 line-clamp-1">{trip.note}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onShowOnMap(trip.id)}
                title="지도에서 위치 보기"
                className="p-1.5 text-slate-300 hover:text-blue-400 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <MapIcon size={14} />
              </button>
              <button
                onClick={startEditing}
                aria-label="여행 편집"
                disabled={mutatingKeys.has(`trip_delete_${trip.id}`)}
                className="p-1.5 text-slate-300 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil size={14} />
              </button>
              {deletePending ? (
                <span className="flex items-center gap-1">
                  <button
                    onClick={confirmDeleteTrip}
                    disabled={mutatingKeys.has(`trip_delete_${trip.id}`)}
                    className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {mutatingKeys.has(`trip_delete_${trip.id}`) ? (
                      <Loader2 size={10} className="animate-spin inline" />
                    ) : (
                      '삭제 확인'
                    )}
                  </button>
                  <button
                    onClick={cancelDeleteTrip}
                    disabled={mutatingKeys.has(`trip_delete_${trip.id}`)}
                    className="text-[10px] px-2 py-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                  >
                    취소
                  </button>
                </span>
              ) : (
                <button
                  onClick={askDeleteTrip}
                  aria-label="여행 삭제"
                  disabled={mutatingKeys.has(`trip_delete_${trip.id}`)}
                  className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {mutatingKeys.has(`trip_delete_${trip.id}`) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
              <button
                onClick={onToggleExpand}
                className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* 체크리스트 progress bar */}
        {total > 0 && !editing && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>준비물 체크리스트</span>
              <span>
                {checked}/{total} · {Math.round((checked / total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300"
                style={{ width: total > 0 ? `${Math.round((checked / total) * 100)}%` : '0%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 확장 패널 */}
      {expanded && (
        <div className="border-t border-slate-100">
          {/* 탭 헤더 */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'checklist'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <CheckSquare size={13} />
              준비물
              {total > 0 && (
                <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                  {checked}/{total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'plan'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ListOrdered size={13} />
              일정
              {(trip.plan_items ?? []).length > 0 && (
                <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                  {(trip.plan_items ?? []).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('restaurant')}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'restaurant'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Utensils size={13} />
              맛집
              {(trip.restaurants ?? []).length > 0 && (
                <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                  {(trip.restaurants ?? []).length}
                </span>
              )}
            </button>
          </div>

          {/* 체크리스트 탭 */}
          {activeTab === 'checklist' && (
            <div className="bg-slate-50/50 px-5 py-4 space-y-2">
              {trip.checklist_items.length === 0 && (
                <p className="text-xs text-slate-400">아직 준비물이 없습니다.</p>
              )}
              {trip.checklist_items.map((item) => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  onToggle={() => onToggleChecklist(trip.id, item.id)}
                  onDelete={() => onDeleteChecklist(trip.id, item.id)}
                  toggleDisabled={mutatingKeys.has(`check_toggle_${item.id}`)}
                  deleteDisabled={mutatingKeys.has(`check_delete_${item.id}`)}
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={checkText}
                  onChange={(e) => setCheckText(e.target.value)}
                  onKeyDown={handleAddChecklist}
                  disabled={mutatingKeys.has(`check_add_${trip.id}`)}
                  placeholder={
                    mutatingKeys.has(`check_add_${trip.id}`) ? '저장 중...' : '항목 추가 후 Enter'
                  }
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* 일정 탭 */}
          {activeTab === 'plan' && (
            <div className="bg-slate-50/50 px-5 py-4 space-y-4">
              {(trip.plan_items ?? []).length === 0 && (
                <p className="text-xs text-slate-400">아직 일정이 없습니다. 아래에서 추가하세요.</p>
              )}

              {/* Day별 그룹 */}
              {Object.entries(planByDay)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, items]) => (
                  <div key={day}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                      Day {day}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((item: TripPlanItemResponse) =>
                        editingPlan?.id === item.id ? (
                          <div
                            key={item.id}
                            className="bg-blue-50 border-l-2 border-blue-400 rounded-lg p-2 space-y-1.5"
                          >
                            <div className="flex gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5">
                                  Day
                                </label>
                                <select
                                  value={editingPlan.day}
                                  onChange={(e) =>
                                    setEditingPlan((p) =>
                                      p ? { ...p, day: Number(e.target.value) } : p,
                                    )
                                  }
                                  className="border border-slate-200 rounded px-1.5 py-1 text-xs bg-white w-16"
                                >
                                  {Array.from({ length: tripDays }, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>
                                      Day {d}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5">
                                  시간
                                </label>
                                <input
                                  type="time"
                                  value={editingPlan.time}
                                  onChange={(e) =>
                                    setEditingPlan((p) => (p ? { ...p, time: e.target.value } : p))
                                  }
                                  className="border border-slate-200 rounded px-1.5 py-1 text-xs w-28"
                                />
                              </div>
                            </div>
                            <input
                              value={editingPlan.title}
                              onChange={(e) =>
                                setEditingPlan((p) => (p ? { ...p, title: e.target.value } : p))
                              }
                              placeholder="제목"
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <input
                              value={editingPlan.description}
                              onChange={(e) =>
                                setEditingPlan((p) =>
                                  p ? { ...p, description: e.target.value } : p,
                                )
                              }
                              placeholder="메모 (선택)"
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setEditingPlan(null)}
                                disabled={mutatingKeys.has(`plan_update_${editingPlan.id}`)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 disabled:opacity-40"
                              >
                                <X size={13} />
                              </button>
                              <button
                                disabled={mutatingKeys.has(`plan_update_${editingPlan.id}`)}
                                onClick={() => {
                                  if (!editingPlan.title.trim()) return;
                                  onUpdatePlanItem(trip.id, editingPlan.id, {
                                    title: editingPlan.title.trim(),
                                    time: editingPlan.time || null,
                                    description: editingPlan.description.trim() || null,
                                    day: editingPlan.day,
                                  });
                                  setEditingPlan(null);
                                }}
                                className="p-1 text-slate-700 hover:text-slate-900 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {mutatingKeys.has(`plan_update_${editingPlan.id}`) ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Check size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={item.id}
                            className="flex items-start gap-2 group cursor-pointer hover:bg-slate-100/60 rounded-lg px-1 py-0.5 -mx-1"
                            onClick={() =>
                              setEditingPlan({
                                id: item.id,
                                day: item.day,
                                title: item.title,
                                time: item.time ?? '',
                                description: item.description ?? '',
                              })
                            }
                          >
                            {item.time && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400 mt-0.5 shrink-0 w-10">
                                <Clock size={9} />
                                {item.time}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700">{item.title}</p>
                              {item.description && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePlanItem(trip.id, item.id);
                              }}
                              disabled={mutatingKeys.has(`plan_delete_${item.id}`)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0 mt-0.5 disabled:opacity-20 disabled:cursor-not-allowed"
                            >
                              {mutatingKeys.has(`plan_delete_${item.id}`) ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}

              {/* 일정 추가 폼 */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <p className="text-[10px] font-semibold text-slate-500">일정 추가</p>
                <div className="flex gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Day</label>
                    <select
                      value={planDay}
                      onChange={(e) => setPlanDay(Number(e.target.value))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white w-16"
                    >
                      {Array.from({ length: tripDays }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">시간 (선택)</label>
                    <input
                      type="time"
                      value={planTime}
                      onChange={(e) => setPlanTime(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 w-28"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">제목 *</label>
                  <input
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPlan()}
                    placeholder="예: 도쿄 타워 방문"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">메모 (선택)</label>
                  <input
                    value={planDesc}
                    onChange={(e) => setPlanDesc(e.target.value)}
                    placeholder="간단한 메모"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  onClick={handleAddPlan}
                  disabled={!planTitle.trim() || mutatingKeys.has(`plan_add_${trip.id}`)}
                  className="w-full py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors font-medium flex items-center justify-center gap-1"
                >
                  {mutatingKeys.has(`plan_add_${trip.id}`) ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '일정 추가'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 맛집 탭 */}
          {activeTab === 'restaurant' && (
            <div className="bg-slate-50/50 px-5 py-4 space-y-2">
              <div className="flex justify-end">
                <button
                  onClick={() => onAddRestaurantOnMap(trip.id)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                >
                  <MapIcon size={11} />
                  지도에서 추가
                </button>
              </div>
              {(trip.restaurants ?? []).length === 0 && (
                <p className="text-xs text-slate-400">
                  아직 등록된 맛집이 없습니다. 주소를 입력하거나 지도에서 위치를 선택하세요.
                </p>
              )}
              {(trip.restaurants ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2"
                >
                  <button
                    onClick={() => onUpdateRestaurant(trip.id, r.id, { is_visited: !r.is_visited })}
                    disabled={mutatingKeys.has(`rest_update_${r.id}`)}
                    title={r.is_visited ? '방문함' : '방문 예정'}
                    className="shrink-0 disabled:opacity-40"
                  >
                    {r.is_visited ? (
                      <CheckSquare size={15} className="text-emerald-500" />
                    ) : (
                      <Square size={15} className="text-slate-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm truncate ${r.is_visited ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                      >
                        {r.name}
                      </span>
                      {r.cuisine && (
                        <span className="text-[10px] text-orange-500 bg-orange-50 rounded-full px-1.5 py-0.5 shrink-0">
                          {r.cuisine}
                        </span>
                      )}
                      {r.latitude != null && r.longitude != null && (
                        <MapPin size={11} className="text-orange-400 shrink-0" />
                      )}
                    </div>
                    {r.address && (
                      <p className="text-[11px] text-slate-400 truncate">{r.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteRestaurant(trip.id, r.id)}
                    disabled={mutatingKeys.has(`rest_delete_${r.id}`)}
                    className="shrink-0 p-1 text-slate-300 hover:text-red-400 rounded disabled:opacity-40"
                  >
                    {mutatingKeys.has(`rest_delete_${r.id}`) ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              ))}
              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 mt-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={restName}
                    onChange={(e) => setRestName(e.target.value)}
                    placeholder="맛집 이름 *"
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <input
                    value={restCuisine}
                    onChange={(e) => setRestCuisine(e.target.value)}
                    placeholder="종류 (예: 라멘)"
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={restAddress}
                    onChange={(e) => setRestAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRestaurant()}
                    placeholder="주소·장소명 (선택, 입력 시 지도에 표시)"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestPicker((v) => !v)}
                    title="지도에서 직접 위치 선택"
                    className={`shrink-0 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                      showRestPicker || restPickedLoc
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={12} className="inline mr-0.5" />
                    {restPickedLoc ? '선택됨' : '지도'}
                  </button>
                </div>
                {showRestPicker && (
                  <LocationPickerMap
                    value={restPickedLoc}
                    onChange={(v) => {
                      setRestPickedLoc(v);
                      if (!v) setShowRestPicker(false);
                    }}
                  />
                )}
                <button
                  onClick={handleAddRestaurant}
                  disabled={!restName.trim() || mutatingKeys.has(`rest_add_${trip.id}`)}
                  className="w-full py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors font-medium flex items-center justify-center gap-1"
                >
                  {mutatingKeys.has(`rest_add_${trip.id}`) ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '맛집 추가'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────
export default function TravelPage() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TripStatus | 'all'>('all');
  const [tripSearch, setTripSearch] = useState('');
  const [exporting, setExporting] = useState<Set<string>>(new Set());
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  // 지도 인스턴스 ref (flyTo 등 명령형 조작용)
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const handleMapReady = useCallback((map: LeafletMap | null) => {
    mapInstanceRef.current = map;
  }, []);

  // 맛집 맵-추가 모드 상태
  const [addRestMode, setAddRestMode] = useState(false);
  const [addRestTripId, setAddRestTripId] = useState<number | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingCuisine, setPendingCuisine] = useState('');
  const [pendingNote, setPendingNote] = useState('');

  async function withMutation(key: string, fn: () => Promise<void>) {
    if (mutating.has(key)) return;
    setMutating((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setMutating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleExport(key: string, fn: () => Promise<void>) {
    if (exporting.has(key)) return;
    setExporting((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setExporting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const load = async () => {
    setError(null);
    try {
      const data = await travelApi.listTrips();
      setTrips(data);
    } catch (err) {
      setError((err as Error).message || '여행 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  useAiRefresh(['travel'], load);

  // 요약 (클라이언트 계산)
  const summary = {
    total: trips.length,
    planned: trips.filter((t) => t.status === 'planned').length,
    ongoing: trips.filter((t) => t.status === 'ongoing').length,
    completed: trips.filter((t) => t.status === 'completed').length,
  };

  // 완료 여행 통계
  const completedTrips = trips.filter((t) => t.status === 'completed');
  const uniqueDestinations = new Set(completedTrips.map((t) => t.destination).filter(Boolean)).size;
  const totalTravelDays = completedTrips.reduce((sum, t) => {
    if (!t.start_date || !t.end_date) return sum;
    return (
      sum +
      Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) +
      1
    );
  }, 0);

  const filtered = trips.filter((t) => {
    const matchStatus = filter === 'all' || t.status === filter;
    const q = tripSearch.trim().toLowerCase();
    const matchSearch =
      !q || t.name.toLowerCase().includes(q) || (t.destination ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // 지도에 표시 가능한 좌표가 하나라도 있는지 (현재 필터 기준)
  const hasMapPoints = filtered.some(
    (t) =>
      (t.latitude != null && t.longitude != null) ||
      (t.restaurants ?? []).some((r) => r.latitude != null && r.longitude != null),
  );

  const showOnMap = (tripId: number) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    if (trip.latitude == null || trip.longitude == null) {
      showToast('먼저 여행에 위치(주소)를 설정해주세요.', 'error');
      return;
    }
    mapInstanceRef.current?.flyTo([trip.latitude, trip.longitude], 13, { duration: 0.8 });
  };

  const cancelAddRestMode = () => {
    setAddRestMode(false);
    setAddRestTripId(null);
    setPendingCoords(null);
    setPendingName('');
    setPendingCuisine('');
    setPendingNote('');
  };

  const enterAddRestMode = (tripId: number) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    cancelAddRestMode();
    setAddRestMode(true);
    setAddRestTripId(tripId);
    setExpandedId(tripId);
    // 여행 좌표가 있으면 지도 이동
    if (trip.latitude != null && trip.longitude != null) {
      mapInstanceRef.current?.flyTo([trip.latitude, trip.longitude], 13, { duration: 0.6 });
    }
  };

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingCoords({ lat, lng });
  }, []);

  const savePendingRestaurant = async () => {
    if (!pendingCoords || !addRestTripId || !pendingName.trim()) return;
    await handleAddRestaurant(addRestTripId, {
      name: pendingName.trim(),
      cuisine: pendingCuisine.trim() || undefined,
      note: pendingNote.trim() || undefined,
      latitude: pendingCoords.lat,
      longitude: pendingCoords.lng,
    });
    cancelAddRestMode();
  };

  const handleCreate = async (data: Parameters<typeof travelApi.createTrip>[0]) => {
    try {
      const created = await travelApi.createTrip(data);
      setTrips((prev) => [created, ...prev]);
      setShowAddForm(false);
      setExpandedId(created.id);
      // 주소를 입력했는데 좌표 해석에 실패한 경우(직접 좌표 미지정), 지도 선택 안내
      if (data.address && data.latitude == null && created.latitude == null) {
        showToast(
          '주소의 위치를 찾지 못했어요. 수정에서 지도를 눌러 직접 선택할 수 있어요.',
          'info',
        );
      }
    } catch {
      showToast('여행 추가에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    await withMutation(`trip_delete_${id}`, async () => {
      setTrips((prev) => prev.filter((t) => t.id !== id));
      try {
        await travelApi.deleteTrip(id);
      } catch {
        showToast('여행 삭제에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleUpdate = async (id: number, data: Partial<TripResponse>) => {
    await withMutation(`trip_update_${id}`, async () => {
      try {
        const updated = await travelApi.updateTrip(
          id,
          data as Parameters<typeof travelApi.updateTrip>[1],
        );
        setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)));
        // 주소를 새로 입력했는데 좌표 해석에 실패한 경우, 지도 선택 안내
        if (data.address && data.latitude == null && updated.latitude == null) {
          showToast('주소의 위치를 찾지 못했어요. 지도를 눌러 직접 선택할 수 있어요.', 'info');
        }
      } catch {
        showToast('여행 수정에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleToggleChecklist = async (tripId: number, itemId: number) => {
    await withMutation(`check_toggle_${itemId}`, async () => {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? {
                ...t,
                checklist_items: t.checklist_items.map((i) =>
                  i.id === itemId ? { ...i, is_checked: !i.is_checked } : i,
                ),
              }
            : t,
        ),
      );
      try {
        await travelApi.toggleChecklistItem(itemId);
      } catch {
        showToast('체크 상태 변경에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleDeleteChecklist = async (tripId: number, itemId: number) => {
    await withMutation(`check_delete_${itemId}`, async () => {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, checklist_items: t.checklist_items.filter((i) => i.id !== itemId) }
            : t,
        ),
      );
      try {
        await travelApi.deleteChecklistItem(itemId);
      } catch {
        showToast('체크리스트 삭제에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleAddChecklist = async (tripId: number, text: string) => {
    await withMutation(`check_add_${tripId}`, async () => {
      try {
        const item = await travelApi.addChecklistItem(tripId, { text });
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, checklist_items: [...t.checklist_items, item] } : t,
          ),
        );
      } catch {
        showToast('항목 추가에 실패했습니다.', 'error');
      }
    });
  };

  const handleAddPlanItem = async (
    tripId: number,
    data: { day: number; title: string; time?: string; description?: string },
  ) => {
    await withMutation(`plan_add_${tripId}`, async () => {
      try {
        const item = await travelApi.addPlanItem(tripId, data);
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, plan_items: [...(t.plan_items ?? []), item] } : t,
          ),
        );
      } catch {
        showToast('일정 추가에 실패했습니다.', 'error');
      }
    });
  };

  const handleUpdatePlanItem = async (
    tripId: number,
    itemId: number,
    data: Partial<{ title: string; time: string | null; description: string | null; day: number }>,
  ) => {
    await withMutation(`plan_update_${itemId}`, async () => {
      try {
        const updated = await travelApi.updatePlanItem(itemId, data);
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  plan_items: (t.plan_items ?? []).map((p) => (p.id === itemId ? updated : p)),
                }
              : t,
          ),
        );
      } catch {
        showToast('일정 수정에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleDeletePlanItem = async (tripId: number, itemId: number) => {
    await withMutation(`plan_delete_${itemId}`, async () => {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, plan_items: (t.plan_items ?? []).filter((p) => p.id !== itemId) }
            : t,
        ),
      );
      try {
        await travelApi.deletePlanItem(itemId);
      } catch {
        showToast('일정 삭제에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleAddRestaurant = async (
    tripId: number,
    data: {
      name: string;
      address?: string;
      cuisine?: string;
      note?: string;
      latitude?: number | null;
      longitude?: number | null;
    },
  ) => {
    await withMutation(`rest_add_${tripId}`, async () => {
      try {
        const r = await travelApi.addRestaurant(tripId, data);
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId ? { ...t, restaurants: [...(t.restaurants ?? []), r] } : t,
          ),
        );
      } catch {
        showToast('맛집 추가에 실패했습니다.', 'error');
      }
    });
  };

  const handleUpdateRestaurant = async (
    tripId: number,
    restaurantId: number,
    data: Partial<{ is_visited: boolean; note: string | null }>,
  ) => {
    await withMutation(`rest_update_${restaurantId}`, async () => {
      try {
        const updated = await travelApi.updateRestaurant(restaurantId, data);
        setTrips((prev) =>
          prev.map((t) =>
            t.id === tripId
              ? {
                  ...t,
                  restaurants: (t.restaurants ?? []).map((r) =>
                    r.id === restaurantId ? updated : r,
                  ),
                }
              : t,
          ),
        );
      } catch {
        showToast('맛집 수정에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  const handleDeleteRestaurant = async (tripId: number, restaurantId: number) => {
    await withMutation(`rest_delete_${restaurantId}`, async () => {
      setTrips((prev) =>
        prev.map((t) =>
          t.id === tripId
            ? { ...t, restaurants: (t.restaurants ?? []).filter((r) => r.id !== restaurantId) }
            : t,
        ),
      );
      try {
        await travelApi.deleteRestaurant(restaurantId);
      } catch {
        showToast('맛집 삭제에 실패했습니다.', 'error');
        await load();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">여행 계획</h1>
          <p className="text-slate-400 text-sm mt-1 truncate">나만의 여행을 계획하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExport('travel', exportApi.travel)}
            disabled={exporting.has('travel')}
            title="CSV 내보내기 (여행·일정·체크리스트·맛집)"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting.has('travel') ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            여행 추가
          </button>
        </div>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors shrink-0"
          >
            <RefreshCw size={12} />
            다시 시도
          </button>
        </div>
      )}

      {/* 추가 폼 */}
      {showAddForm && <AddTripForm onSave={handleCreate} onCancel={() => setShowAddForm(false)} />}

      {/* 요약 바 + 검색 */}
      {trips.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['all', '전체', summary.total, 'bg-slate-100 text-slate-600'],
                ['planned', '예정', summary.planned, 'bg-blue-100 text-blue-700'],
                ['ongoing', '진행중', summary.ongoing, 'bg-emerald-100 text-emerald-700'],
                ['completed', '완료', summary.completed, 'bg-slate-100 text-slate-500'],
              ] as const
            ).map(([key, label, count, cls]) => (
              <button
                key={key}
                onClick={() => setFilter(key as TripStatus | 'all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === key
                    ? cls + ' ring-2 ring-offset-1 ring-current'
                    : cls + ' opacity-60 hover:opacity-100'
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>
          {summary.completed > 0 && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span>
                🌍 방문 목적지{' '}
                <span className="font-semibold text-slate-700">{uniqueDestinations}곳</span>
              </span>
              {totalTravelDays > 0 && (
                <span>
                  📅 총 <span className="font-semibold text-slate-700">{totalTravelDays}일</span>
                </span>
              )}
            </div>
          )}
          {trips.length > 3 && (
            <input
              type="text"
              value={tripSearch}
              onChange={(e) => setTripSearch(e.target.value)}
              placeholder="여행 이름·목적지 검색..."
              className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          )}
        </div>
      )}

      {/* 지도 패널 — 여행이 있으면 항상 표시 */}
      {trips.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-1.5">
              <MapIcon size={13} />
              <span>
                지도 —{' '}
                <span
                  className="inline-block w-2 h-2 rounded-full align-middle"
                  style={{ background: '#0f172a' }}
                />{' '}
                여행 ·{' '}
                <span
                  className="inline-block w-2 h-2 rounded-full align-middle"
                  style={{ background: '#f97316' }}
                />{' '}
                맛집 {!addRestMode && '(마커 클릭 시 해당 여행 펼침)'}
              </span>
            </div>
            {addRestMode && (
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-medium">
                  {pendingCoords ? '아래 폼을 작성하고 저장하세요' : '지도를 클릭하여 위치 선택'}
                </span>
                <button
                  onClick={cancelAddRestMode}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
          <TravelMap
            trips={filtered}
            onSelectTrip={(id) => setExpandedId(id)}
            onMapReady={handleMapReady}
            addRestaurantMode={addRestMode}
            onMapClick={handleMapClick}
            pendingMarker={pendingCoords}
          />
          {!hasMapPoints && !addRestMode && (
            <p className="text-xs text-slate-400 px-1">
              여행이나 맛집에{' '}
              <span className="font-medium text-slate-600">위치(주소 또는 지도 선택)</span>를
              입력하면 지도에 표시돼요.
            </p>
          )}
          {/* 맛집 맵-추가 인라인 폼 */}
          {addRestMode && pendingCoords && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  맛집 추가
                  {addRestTripId && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      — {trips.find((t) => t.id === addRestTripId)?.name}
                    </span>
                  )}
                </p>
                <span className="text-[10px] font-mono text-emerald-600">
                  {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  placeholder="맛집 이름 *"
                  autoFocus
                  className="col-span-2 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  value={pendingCuisine}
                  onChange={(e) => setPendingCuisine(e.target.value)}
                  placeholder="종류 (예: 라멘)"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <input
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="메모 (선택)"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingCoords(null)}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  다시 선택
                </button>
                <button
                  onClick={cancelAddRestMode}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={savePendingRestaurant}
                  disabled={
                    !pendingName.trim() ||
                    (addRestTripId ? mutating.has(`rest_add_${addRestTripId}`) : false)
                  }
                  className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1.5"
                >
                  {addRestTripId && mutating.has(`rest_add_${addRestTripId}`) ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '저장'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 여행 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <Plane size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-700 font-semibold">
            {tripSearch
              ? '검색 결과가 없습니다'
              : filter === 'all'
                ? '첫 여행을 계획해보세요!'
                : `${STATUS_META[filter as TripStatus].label} 여행이 없습니다`}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {tripSearch
              ? '다른 키워드나 필터를 시도해보세요'
              : filter === 'all'
                ? '오른쪽 상단의 "여행 추가" 버튼을 눌러 시작하세요'
                : '다른 상태의 여행을 확인해보세요'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              expanded={expandedId === trip.id}
              onToggleExpand={() => setExpandedId(expandedId === trip.id ? null : trip.id)}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onToggleChecklist={handleToggleChecklist}
              onDeleteChecklist={handleDeleteChecklist}
              onAddChecklist={handleAddChecklist}
              onAddPlanItem={handleAddPlanItem}
              onUpdatePlanItem={handleUpdatePlanItem}
              onDeletePlanItem={handleDeletePlanItem}
              onAddRestaurant={handleAddRestaurant}
              onUpdateRestaurant={handleUpdateRestaurant}
              onDeleteRestaurant={handleDeleteRestaurant}
              onShowOnMap={showOnMap}
              onAddRestaurantOnMap={enterAddRestMode}
              mutatingKeys={mutating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
