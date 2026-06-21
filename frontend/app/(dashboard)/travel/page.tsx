'use client';

import { useEffect, useState, useRef } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import {
  Plane, MapPin, Calendar, Plus, Trash2, Pencil, Check, X,
  ChevronDown, ChevronUp, CheckSquare, Square, AlertCircle, Clock, ListOrdered,
} from 'lucide-react';
import { travelApi } from '@/lib/api';
import type { TripResponse, TripStatus, ChecklistItemResponse, TripPlanItemResponse } from '@/types';

// ── 상태 배지 ──────────────────────────────────────────────
const STATUS_META: Record<TripStatus, { label: string; cls: string }> = {
  planned:   { label: '예정',   cls: 'bg-blue-100 text-blue-700' },
  ongoing:   { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
  completed: { label: '완료',   cls: 'bg-slate-100 text-slate-500' },
};

function StatusBadge({ status }: { status: TripStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>
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

// ── 체크리스트 행 ──────────────────────────────────────────
function ChecklistRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItemResponse;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <button onClick={onToggle} className="text-slate-400 hover:text-slate-700 transition-colors shrink-0">
        {item.is_checked
          ? <CheckSquare size={16} className="text-slate-700" />
          : <Square size={16} />}
      </button>
      <span className={`flex-1 text-sm ${item.is_checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
        {item.text}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── 여행 추가 폼 ───────────────────────────────────────────
interface AddTripFormProps {
  onSave: (data: {
    name: string; destination: string; start_date: string; end_date: string;
    status: TripStatus; note: string;
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
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !dest.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), destination: dest.trim(), start_date: startDate, end_date: endDate, status, note: note.trim() });
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
            onChange={e => setName(e.target.value)}
            placeholder="예: 도쿄 여행"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            onKeyDown={e => e.key === 'Escape' && onCancel()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">목적지 *</label>
          <input
            value={dest}
            onChange={e => setDest(e.target.value)}
            placeholder="예: 일본 도쿄"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">출발일</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">귀국일</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">상태</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as TripStatus)}
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
            onChange={e => setNote(e.target.value)}
            placeholder="간단한 메모 (선택)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
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
  onAddPlanItem: (tripId: number, data: { day: number; title: string; time?: string; description?: string }) => void;
  onDeletePlanItem: (tripId: number, itemId: number) => void;
}

function TripCard({
  trip, expanded, onToggleExpand,
  onDelete, onUpdate,
  onToggleChecklist, onDeleteChecklist, onAddChecklist,
  onAddPlanItem, onDeletePlanItem,
}: TripCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(trip.name);
  const [editDest, setEditDest] = useState(trip.destination);
  const [editStatus, setEditStatus] = useState<TripStatus>(trip.status as TripStatus);
  const [editNote, setEditNote] = useState(trip.note ?? '');
  const [checkText, setCheckText] = useState('');
  const [activeTab, setActiveTab] = useState<'checklist' | 'plan'>('checklist');
  const [planDay, setPlanDay] = useState(1);
  const [planTime, setPlanTime] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDesc, setPlanDesc] = useState('');

  const checked = trip.checklist_items.filter(i => i.is_checked).length;
  const total = trip.checklist_items.length;

  const tripDays = Math.max(1, Math.round(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000
  ) + 1);

  const planByDay = trip.plan_items.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = [];
    acc[item.day].push(item);
    return acc;
  }, {} as Record<number, TripPlanItemResponse[]>);

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

  const saveEdit = () => {
    onUpdate(trip.id, {
      name: editName.trim() || trip.name,
      destination: editDest.trim() || trip.destination,
      status: editStatus,
      note: editNote.trim() || null,
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
                onChange={e => setEditName(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="여행 이름"
                autoFocus
              />
              <input
                value={editDest}
                onChange={e => setEditDest(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="목적지"
              />
              <select
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as TripStatus)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="planned">예정</option>
                <option value="ongoing">진행중</option>
                <option value="completed">완료</option>
              </select>
              <input
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="메모 (선택)"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={15} />
              </button>
              <button onClick={saveEdit} className="p-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100">
                <Check size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <StatusBadge status={trip.status as TripStatus} />
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
                onClick={() => setEditing(true)}
                className="p-1.5 text-slate-300 hover:text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(trip.id)}
                className="p-1.5 text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
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
              <span>{checked}/{total}</span>
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
              {trip.plan_items.length > 0 && (
                <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                  {trip.plan_items.length}
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
              {trip.checklist_items.map(item => (
                <ChecklistRow
                  key={item.id}
                  item={item}
                  onToggle={() => onToggleChecklist(trip.id, item.id)}
                  onDelete={() => onDeleteChecklist(trip.id, item.id)}
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={checkText}
                  onChange={e => setCheckText(e.target.value)}
                  onKeyDown={handleAddChecklist}
                  placeholder="항목 추가 후 Enter"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>
          )}

          {/* 일정 탭 */}
          {activeTab === 'plan' && (
            <div className="bg-slate-50/50 px-5 py-4 space-y-4">
              {trip.plan_items.length === 0 && (
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
                      {items.map((item: TripPlanItemResponse) => (
                        <div key={item.id} className="flex items-start gap-2 group">
                          {item.time && (
                            <span className="flex items-center gap-0.5 text-[10px] text-slate-400 mt-0.5 shrink-0 w-10">
                              <Clock size={9} />
                              {item.time}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700">{item.title}</p>
                            {item.description && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onDeletePlanItem(trip.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all shrink-0 mt-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
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
                      onChange={e => setPlanDay(Number(e.target.value))}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white w-16"
                    >
                      {Array.from({ length: tripDays }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Day {d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">시간 (선택)</label>
                    <input
                      type="time"
                      value={planTime}
                      onChange={e => setPlanTime(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 w-28"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">제목 *</label>
                  <input
                    value={planTitle}
                    onChange={e => setPlanTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPlan()}
                    placeholder="예: 도쿄 타워 방문"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">메모 (선택)</label>
                  <input
                    value={planDesc}
                    onChange={e => setPlanDesc(e.target.value)}
                    placeholder="간단한 메모"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  onClick={handleAddPlan}
                  disabled={!planTitle.trim()}
                  className="w-full py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors font-medium"
                >
                  일정 추가
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

  const load = async () => {
    try {
      const data = await travelApi.listTrips();
      setTrips(data);
    } catch {
      setError('여행 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useAiRefresh(['travel'], load);

  // 요약 (클라이언트 계산)
  const summary = {
    total: trips.length,
    planned: trips.filter(t => t.status === 'planned').length,
    ongoing: trips.filter(t => t.status === 'ongoing').length,
    completed: trips.filter(t => t.status === 'completed').length,
  };

  const filtered = filter === 'all' ? trips : trips.filter(t => t.status === filter);

  const handleCreate = async (data: Parameters<typeof travelApi.createTrip>[0]) => {
    const created = await travelApi.createTrip(data);
    setTrips(prev => [created, ...prev]);
    setShowAddForm(false);
    setExpandedId(created.id);
  };

  const handleDelete = async (id: number) => {
    setTrips(prev => prev.filter(t => t.id !== id));
    try { await travelApi.deleteTrip(id); }
    catch { await load(); }
  };

  const handleUpdate = async (id: number, data: Partial<TripResponse>) => {
    try {
      const updated = await travelApi.updateTrip(id, data as Parameters<typeof travelApi.updateTrip>[1]);
      setTrips(prev => prev.map(t => t.id === id ? updated : t));
    } catch { await load(); }
  };

  const handleToggleChecklist = async (tripId: number, itemId: number) => {
    // 낙관적 업데이트
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, checklist_items: t.checklist_items.map(i => i.id === itemId ? { ...i, is_checked: !i.is_checked } : i) }
        : t
    ));
    try { await travelApi.toggleChecklistItem(itemId); }
    catch { await load(); }
  };

  const handleDeleteChecklist = async (tripId: number, itemId: number) => {
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, checklist_items: t.checklist_items.filter(i => i.id !== itemId) }
        : t
    ));
    try { await travelApi.deleteChecklistItem(itemId); }
    catch { await load(); }
  };

  const handleAddChecklist = async (tripId: number, text: string) => {
    try {
      const item = await travelApi.addChecklistItem(tripId, { text });
      setTrips(prev => prev.map(t =>
        t.id === tripId
          ? { ...t, checklist_items: [...t.checklist_items, item] }
          : t
      ));
    } catch { /* silent */ }
  };

  const handleAddPlanItem = async (tripId: number, data: { day: number; title: string; time?: string; description?: string }) => {
    try {
      const item = await travelApi.addPlanItem(tripId, data);
      setTrips(prev => prev.map(t =>
        t.id === tripId
          ? { ...t, plan_items: [...t.plan_items, item] }
          : t
      ));
    } catch { /* silent */ }
  };

  const handleDeletePlanItem = async (tripId: number, itemId: number) => {
    setTrips(prev => prev.map(t =>
      t.id === tripId
        ? { ...t, plan_items: t.plan_items.filter(p => p.id !== itemId) }
        : t
    ));
    try { await travelApi.deletePlanItem(itemId); }
    catch { await load(); }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">여행 계획</h1>
          <p className="text-slate-400 text-sm mt-1">나만의 여행을 계획하고 관리하세요</p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          여행 추가
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* 추가 폼 */}
      {showAddForm && (
        <AddTripForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* 요약 바 */}
      {trips.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {([
            ['all', '전체', summary.total, 'bg-slate-100 text-slate-600'],
            ['planned', '예정', summary.planned, 'bg-blue-100 text-blue-700'],
            ['ongoing', '진행중', summary.ongoing, 'bg-emerald-100 text-emerald-700'],
            ['completed', '완료', summary.completed, 'bg-slate-100 text-slate-500'],
          ] as const).map(([key, label, count, cls]) => (
            <button
              key={key}
              onClick={() => setFilter(key as TripStatus | 'all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === key ? cls + ' ring-2 ring-offset-1 ring-current' : cls + ' opacity-60 hover:opacity-100'
              }`}
            >
              {label} {count}
            </button>
          ))}
        </div>
      )}

      {/* 여행 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <Plane size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-700 font-semibold">
            {filter === 'all' ? '첫 여행을 계획해보세요!' : `${STATUS_META[filter as TripStatus].label} 여행이 없습니다`}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {filter === 'all' ? '오른쪽 상단의 "여행 추가" 버튼을 눌러 시작하세요' : '다른 상태의 여행을 확인해보세요'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(trip => (
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
              onDeletePlanItem={handleDeletePlanItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
