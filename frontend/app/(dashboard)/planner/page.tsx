'use client';

import { useEffect, useRef, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { Plus, Trash2, Check, X, Pencil, AlertTriangle, Settings2, Loader2, CalendarClock } from 'lucide-react';
import { plannerApi } from '@/lib/api';
import type { PhaseResponse, RoadmapItemResponse, ItemStatus } from '@/types';

// ─── 상태 계산 ──────────────────────────────────────────
function computeStatus(deadline: string | null, isCompleted: boolean): ItemStatus | null {
  if (!deadline) return null;
  if (isCompleted) return 'completed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline);
  const diff = Math.round((dl.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff <= 30) return 'urgent';
  return 'on_track';
}

// ─── 배지 ──────────────────────────────────────────────
const statusStyle: Record<ItemStatus, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  on_track:  'bg-blue-100 text-blue-700',
  urgent:    'bg-amber-100 text-amber-700',
  overdue:   'bg-red-100 text-red-600',
};
const statusLabel: Record<ItemStatus, string> = {
  completed: '완료', on_track: '진행중', urgent: '임박', overdue: '지연',
};

function Badge({ status }: { status: ItemStatus | null }) {
  if (!status) return null;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusStyle[status]}`}>
      {statusLabel[status]}
    </span>
  );
}

// ─── 개별 항목 행 ────────────────────────────────────────
interface ItemRowProps {
  item: RoadmapItemResponse;
  phaseStartDate: string | null;
  onToggle: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
  onEditSave: (id: number, data: { text?: string; offset?: number }) => void;
}

function ItemRow({ item, phaseStartDate, onToggle, onDelete, onEditSave }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // offset ↔ date 변환 유틸
  function dateToOffset(dateStr: string): number {
    if (!phaseStartDate) return 0;
    const start = new Date(phaseStartDate);
    const end = new Date(dateStr);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  }

  function handleDeadlineChange(val: string) {
    if (!val) return;
    onEditSave(item.id, { offset: dateToOffset(val) });
    setEditingDeadline(false);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function startEdit() {
    setDraft(item.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function save() {
    if (draft.trim() && draft.trim() !== item.text) onEditSave(item.id, { text: draft.trim() });
    setEditing(false);
  }

  function cancel() {
    setDraft(item.text);
    setEditing(false);
  }

  function askDelete() {
    setPendingDelete(true);
    timerRef.current = setTimeout(() => setPendingDelete(false), 3000);
  }

  function cancelDelete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingDelete(false);
  }

  async function confirmDelete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
      setPendingDelete(false);
    }
  }

  return (
    <div className={`flex items-center gap-2.5 py-2 px-2 rounded-lg group transition-colors hover:bg-slate-50 ${item.is_completed ? 'opacity-55' : ''}`}>
      <button
        onClick={() => onToggle(item.id)}
        className={`shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${
          item.is_completed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 hover:border-slate-500'
        }`}
        style={{ width: 18, height: 18 }}
      >
        {item.is_completed && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className="flex-1 text-sm border border-slate-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
        />
      ) : (
        <span
          className={`flex-1 text-sm leading-snug cursor-text select-none ${
            item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'
          }`}
          onDoubleClick={startEdit}
          title="더블클릭으로 편집"
        >
          {item.text}
        </span>
      )}

      {/* 마감일 표시 & 편집 */}
      {!editing && !pendingDelete && (
        <div className="shrink-0 relative">
          {editingDeadline ? (
            <input
              ref={dateRef}
              type="date"
              defaultValue={item.deadline ?? ''}
              min={phaseStartDate ?? undefined}
              autoFocus
              onChange={e => handleDeadlineChange(e.target.value)}
              onBlur={() => setEditingDeadline(false)}
              className="text-[11px] border border-slate-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white w-32"
            />
          ) : (
            <button
              onClick={() => phaseStartDate && setEditingDeadline(true)}
              title={phaseStartDate ? '클릭해서 마감일 변경' : '로드맵 시작일을 먼저 설정하세요'}
              className={`flex items-center gap-0.5 text-[11px] rounded px-1 py-0.5 transition-colors group/dl ${
                item.deadline
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  : 'text-slate-300 hover:text-slate-400 hover:bg-slate-50'
              } ${!phaseStartDate ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <CalendarClock size={10} className="opacity-0 group-hover/dl:opacity-100 transition-opacity" />
              <span>{item.deadline ?? '—'}</span>
            </button>
          )}
        </div>
      )}

      {!editing && !pendingDelete && <Badge status={item.status} />}

      {editing ? (
        <div className="flex gap-1 shrink-0">
          <button onClick={save} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
          <button onClick={cancel} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X size={14} /></button>
        </div>
      ) : pendingDelete ? (
        <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
          <span className="text-[11px] font-semibold text-red-500">삭제?</span>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className="p-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {deleting
              ? <Loader2 size={12} className="animate-spin" />
              : <Check size={12} strokeWidth={3} />}
          </button>
          <button onClick={cancelDelete} className="p-1 rounded text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={startEdit}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="편집"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={askDelete}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="삭제"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 항목 추가 폼 ────────────────────────────────────────
interface AddItemFormProps {
  categoryId: number;
  phaseStartDate: string | null;
  onSave: (text: string, offset: number) => Promise<void>;
  onCancel: () => void;
}

function AddItemForm({ categoryId: _cid, phaseStartDate, onSave, onCancel }: AddItemFormProps) {
  const [text, setText] = useState('');
  const [offset, setOffset] = useState('6');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  // 날짜 → offset
  function dateToOffset(dateStr: string): number {
    if (!phaseStartDate || !dateStr) return Number(offset);
    const start = new Date(phaseStartDate);
    const end = new Date(dateStr);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  }

  // offset → 날짜
  function offsetToDate(val: string): string {
    if (!phaseStartDate || !val) return '';
    const d = new Date(phaseStartDate);
    d.setDate(d.getDate() + Math.round(Number(val) * 30.44));
    return d.toISOString().split('T')[0];
  }

  function handleOffsetChange(val: string) {
    setOffset(val);
    setDeadlineDate(offsetToDate(val));
  }

  function handleDateChange(val: string) {
    setDeadlineDate(val);
    if (val) setOffset(String(dateToOffset(val)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim(), deadlineDate ? dateToOffset(deadlineDate) : Number(offset));
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="py-2 px-2 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="항목 내용..."
          className="flex-1 text-sm bg-white border border-slate-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-slate-900 placeholder-slate-400 text-slate-700"
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        />
        <button type="submit" disabled={saving || !text.trim()}
          className="p-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors shrink-0">
          <Check size={13} strokeWidth={3} />
        </button>
        <button type="button" onClick={onCancel}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-400 shrink-0">마감일</span>
        {phaseStartDate ? (
          <input
            type="date"
            value={deadlineDate}
            min={phaseStartDate}
            onChange={e => handleDateChange(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
          />
        ) : (
          <>
            <input
              type="number"
              value={offset}
              onChange={e => handleOffsetChange(e.target.value)}
              min="0"
              step="0.5"
              className="w-14 text-xs text-center bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <span className="text-[10px] text-slate-400">개월 후</span>
          </>
        )}
        {phaseStartDate && (
          <span className="text-[10px] text-slate-400 shrink-0">({offset}개월 후)</span>
        )}
      </div>
    </form>
  );
}

// ─── 카테고리 카드 ────────────────────────────────────────
interface CategoryCardProps {
  cat: PhaseResponse['categories'][0];
  phaseStartDate: string | null;
  onToggle: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
  onEditSave: (id: number, data: { text?: string; offset?: number }) => void;
  onAddItem: (categoryId: number, text: string, offset: number) => Promise<void>;
  onCategoryUpdate: (id: number, icon: string, title: string, subtitle: string) => Promise<void>;
  onCategoryDelete: (id: number) => Promise<void>;
}

function CategoryCard({ cat, phaseStartDate, onToggle, onDelete, onEditSave, onAddItem, onCategoryUpdate, onCategoryDelete }: CategoryCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaIcon, setMetaIcon] = useState(cat.icon);
  const [metaTitle, setMetaTitle] = useState(cat.title);
  const [metaSubtitle, setMetaSubtitle] = useState(cat.subtitle);
  const [metaSaving, setMetaSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }, []);

  const done = cat.items.filter(i => i.is_completed).length;
  const total = cat.items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function startEditMeta() {
    setMetaIcon(cat.icon);
    setMetaTitle(cat.title);
    setMetaSubtitle(cat.subtitle);
    setEditingMeta(true);
  }

  async function saveMeta() {
    if (!metaTitle.trim()) return;
    setMetaSaving(true);
    await onCategoryUpdate(cat.id, metaIcon.trim() || cat.icon, metaTitle.trim(), metaSubtitle.trim());
    setMetaSaving(false);
    setEditingMeta(false);
  }

  function cancelMeta() { setEditingMeta(false); }

  function askDelete() {
    setPendingDelete(true);
    deleteTimerRef.current = setTimeout(() => setPendingDelete(false), 3000);
  }

  function cancelDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete(false);
  }

  async function confirmDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setDeleting(true);
    try {
      await onCategoryDelete(cat.id);
    } finally {
      setDeleting(false);
      setPendingDelete(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        {editingMeta ? (
          /* ── 카테고리 메타 편집 폼 ── */
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <input
                value={metaIcon}
                onChange={e => setMetaIcon(e.target.value)}
                className="w-12 text-center text-xl border border-slate-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="아이콘"
                maxLength={2}
              />
              <input
                value={metaTitle}
                onChange={e => setMetaTitle(e.target.value)}
                className="flex-1 text-sm font-bold border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="카테고리 제목"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveMeta(); if (e.key === 'Escape') cancelMeta(); }}
              />
            </div>
            <input
              value={metaSubtitle}
              onChange={e => setMetaSubtitle(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-500"
              placeholder="부제목"
            />
            <div className="flex justify-end gap-1.5">
              <button onClick={cancelMeta} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100">취소</button>
              <button
                onClick={saveMeta}
                disabled={metaSaving || !metaTitle.trim()}
                className="px-3 py-1 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {metaSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          /* ── 카테고리 메타 표시 ── */
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl leading-none shrink-0">{cat.icon}</span>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{cat.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{cat.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {pendingDelete ? (
                <>
                  <span className="text-[11px] font-semibold text-red-500 whitespace-nowrap">카드 삭제?</span>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                  </button>
                  <button onClick={cancelDelete} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-400 font-medium mr-0.5">{done}/{total}</span>
                  <button onClick={startEditMeta} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors" title="편집">
                    <Pencil size={13} />
                  </button>
                  <button onClick={askDelete} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="카드 삭제">
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => setShowAdd(v => !v)}
                    className={`p-1.5 rounded-lg transition-all ${showAdd ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    title="항목 추가"
                  >
                    <Plus size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 진행률 바 */}
        {!editingMeta && (
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* 항목 목록 */}
      <div className="px-3 pb-3 space-y-0.5 min-h-[40px]">
        {cat.items.length === 0 && !showAdd && (
          <p className="text-xs text-slate-400 py-2 px-2">항목이 없습니다. + 버튼으로 추가하세요.</p>
        )}
        {cat.items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            phaseStartDate={phaseStartDate}
            onToggle={onToggle}
            onDelete={onDelete}
            onEditSave={onEditSave}
          />
        ))}
        {showAdd && (
          <AddItemForm
            categoryId={cat.id}
            phaseStartDate={phaseStartDate}
            onSave={async (text, offset) => {
              await onAddItem(cat.id, text, offset);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── 카테고리 추가 폼 ─────────────────────────────────────
interface AddCategoryFormProps {
  phaseId: number;
  onSave: (phaseId: number, icon: string, title: string, subtitle: string) => Promise<void>;
  onCancel: () => void;
}

function AddCategoryForm({ phaseId, onSave, onCancel }: AddCategoryFormProps) {
  const [icon, setIcon] = useState('📌');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(phaseId, icon.trim() || '📌', title.trim(), subtitle.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="col-span-2 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">새 카테고리</p>
      <div className="flex gap-2">
        <input
          value={icon}
          onChange={e => setIcon(e.target.value)}
          className="w-12 text-center text-xl border border-slate-200 rounded-xl px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          placeholder="📌"
          maxLength={2}
        />
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="카테고리 이름 (필수)"
          autoFocus
          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
        />
      </div>
      <input
        value={subtitle}
        onChange={e => setSubtitle(e.target.value)}
        placeholder="부제목 (선택)"
        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-500 bg-white"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100">취소</button>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 font-medium"
        >
          {saving ? '추가 중...' : '추가'}
        </button>
      </div>
    </form>
  );
}

// ─── Phase 편집 패널 ──────────────────────────────────────
interface PhaseEditPanelProps {
  phase: PhaseResponse;
  onSave: (id: number, name: string, label: string, months: number, color: string) => Promise<void>;
  onClose: () => void;
}

function PhaseEditPanel({ phase, onSave, onClose }: PhaseEditPanelProps) {
  const [name, setName] = useState(phase.name);
  const [label, setLabel] = useState(phase.label);
  const [months, setMonths] = useState(String(phase.months));
  const [color, setColor] = useState(phase.color);
  const [saving, setSaving] = useState(false);

  // 종료일 파생: phase.start_date + months
  const computedEndDate = (() => {
    if (!phase.start_date || !months || isNaN(Number(months))) return null;
    const d = new Date(phase.start_date);
    d.setMonth(d.getMonth() + Number(months));
    return d.toISOString().split('T')[0];
  })();

  function handleEndDateChange(val: string) {
    if (!val || !phase.start_date) return;
    const start = new Date(phase.start_date);
    const end = new Date(val);
    const diffMs = end.getTime() - start.getTime();
    const diffMonths = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44)));
    setMonths(String(diffMonths));
  }

  async function handleSave() {
    if (!name.trim() || !label.trim() || !months) return;
    setSaving(true);
    await onSave(phase.id, name.trim(), label.trim(), Number(months), color);
    setSaving(false);
    onClose();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-slate-700">Phase 편집</p>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Phase 이름</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="예: Phase 1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">레이블 (부제목)</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            placeholder="예: 기반 다지기"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">기간 (개월)</label>
          <input
            type="number"
            min="1"
            max="120"
            value={months}
            onChange={e => setMonths(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            종료일 {phase.start_date ? <span className="text-slate-400">(자동 계산)</span> : <span className="text-slate-300">(시작일 미설정)</span>}
          </label>
          <input
            type="date"
            value={computedEndDate ?? ''}
            min={phase.start_date ?? undefined}
            disabled={!phase.start_date}
            onChange={e => handleEndDateChange(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 mb-1 block">색상</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            />
            <input
              value={color}
              onChange={e => setColor(e.target.value)}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="#6366f1"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100">
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || !label.trim()}
          className="px-4 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 font-medium"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────
interface UrgentItem { id: number; text: string; deadline: string; status: ItemStatus; phase: string; category: string; }

export default function PlannerPage() {
  const [phases, setPhases] = useState<PhaseResponse[]>([]);
  const [startDate, setStartDate] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  async function loadRoadmap() {
    const roadmap = await plannerApi.getRoadmap();
    setPhases(roadmap.phases);
    if (roadmap.start_date) setStartDate(roadmap.start_date);
  }

  useEffect(() => {
    setError(null);
    loadRoadmap()
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  useAiRefresh(['planner'], loadRoadmap);

  async function handleSaveDate() {
    setSaving(true);
    try {
      await plannerApi.updateSettings(startDate || null);
      await loadRoadmap();
    } catch {
      setError('시작일 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: number) {
    try {
      const result = await plannerApi.toggleItem(id);
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.map(c => ({
          ...c,
          items: c.items.map(i =>
            i.id === id
              ? { ...i, is_completed: result.is_completed, status: computeStatus(i.deadline, result.is_completed) }
              : i
          ),
        })),
      })));
    } catch {
      setError('체크 저장에 실패했습니다.');
    }
  }

  async function handleDelete(id: number) {
    try {
      await plannerApi.deleteItem(id);
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.map(c => ({
          ...c,
          items: c.items.filter(i => i.id !== id),
        })),
      })));
    } catch {
      setError('삭제에 실패했습니다.');
      throw new Error('delete failed');
    }
  }

  async function handleEditSave(id: number, data: { text?: string; offset?: number }) {
    try {
      await plannerApi.updateItem(id, data);
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.map(c => ({
          ...c,
          items: c.items.map(i => i.id === id ? { ...i, text } : i),
        })),
      })));
    } catch {
      setError('수정에 실패했습니다.');
    }
  }

  async function handleAddItem(categoryId: number, text: string, offset: number) {
    try {
      await plannerApi.createItem({ category_id: categoryId, text, offset });
      await loadRoadmap();
    } catch {
      setError('항목 추가에 실패했습니다.');
    }
  }

  async function handlePhaseUpdate(id: number, name: string, label: string, months: number, color: string) {
    try {
      await plannerApi.updatePhase(id, { name, label, months, color });
      setPhases(prev => prev.map(p =>
        p.id === id ? { ...p, name, label, months, color } : p
      ));
      // 기간이 바뀌면 deadline도 바뀌므로 전체 재조회
      await loadRoadmap();
    } catch {
      setError('Phase 수정에 실패했습니다.');
    }
  }

  async function handleCategoryUpdate(id: number, icon: string, title: string, subtitle: string) {
    try {
      await plannerApi.updateCategory(id, { icon, title, subtitle });
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.map(c =>
          c.id === id ? { ...c, icon, title, subtitle } : c
        ),
      })));
    } catch {
      setError('카테고리 수정에 실패했습니다.');
    }
  }

  async function handleCategoryDelete(id: number) {
    try {
      await plannerApi.deleteCategory(id);
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.filter(c => c.id !== id),
      })));
    } catch {
      setError('카테고리 삭제에 실패했습니다.');
      throw new Error('delete failed');
    }
  }

  async function handleCategoryCreate(phaseId: number, icon: string, title: string, subtitle: string) {
    try {
      const newCat = await plannerApi.createCategory({ phase_id: phaseId, icon, title, subtitle });
      setPhases(prev => prev.map(p =>
        p.id === phaseId ? { ...p, categories: [...p.categories, { ...newCat, items: [] }] } : p
      ));
      setShowAddCategory(false);
    } catch {
      setError('카테고리 추가에 실패했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  const activePhase = phases[activeTab];
  const allItems = phases.flatMap(p => p.categories.flatMap(c => c.items));
  const totalItems = allItems.length;
  const doneItems = allItems.filter(i => i.is_completed).length;
  const completionPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const urgentItems: UrgentItem[] = phases.flatMap(p =>
    p.categories.flatMap(c =>
      c.items
        .filter(i => i.status === 'urgent' || i.status === 'overdue')
        .map(i => ({ id: i.id, text: i.text, deadline: i.deadline!, status: i.status!, phase: p.name, category: c.title }))
    )
  ).sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">플래너</h1>
          <p className="text-slate-400 text-sm mt-1">
            5년 로드맵 · 전체 {completionPct}% 달성 ({doneItems}/{totalItems})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white shadow-sm"
          />
          <button
            onClick={handleSaveDate}
            disabled={saving}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '적용'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4"><X size={14} /></button>
        </div>
      )}

      {/* 전체 진행률 바 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">전체 진행률</span>
          <span className="text-sm font-semibold text-slate-900">{completionPct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* 임박/지연 항목 */}
      {urgentItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <p className="font-semibold text-amber-800 text-sm">주의 필요 ({urgentItems.length}개)</p>
          </div>
          <div className="space-y-1.5">
            {urgentItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                  item.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.status === 'overdue' ? '지연' : '임박'}
                </span>
                <span className="text-slate-700 flex-1 truncate">{item.text}</span>
                <span className="text-slate-400 text-xs shrink-0">{item.deadline}</span>
                <span className="text-slate-400 text-xs shrink-0 hidden sm:inline">· {item.phase} / {item.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 탭 */}
      <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl">
        {phases.map((phase, idx) => {
          const pDone = phase.categories.flatMap(c => c.items).filter(i => i.is_completed).length;
          const pTotal = phase.categories.flatMap(c => c.items).length;
          const isActive = activeTab === idx;
          return (
            <div
              key={phase.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveTab(idx); setEditingPhaseId(null); setShowAddCategory(false); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setActiveTab(idx); setEditingPhaseId(null); setShowAddCategory(false); } }}
              className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-medium transition-all duration-200 relative group cursor-pointer select-none ${
                isActive
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                <span className="truncate">{phase.name}</span>
                {isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingPhaseId(editingPhaseId === phase.id ? null : phase.id); }}
                    className="p-0.5 rounded text-slate-300 hover:text-slate-600 transition-colors ml-0.5"
                    title="Phase 편집"
                  >
                    <Settings2 size={12} />
                  </button>
                )}
              </div>
              <div className="text-[11px] font-normal text-slate-400">{phase.label}</div>
              <div className="text-[11px] font-normal opacity-60">{pDone}/{pTotal}</div>
            </div>
          );
        })}
      </div>

      {/* Phase 편집 패널 */}
      {activePhase && editingPhaseId === activePhase.id && (
        <PhaseEditPanel
          phase={activePhase}
          onSave={handlePhaseUpdate}
          onClose={() => setEditingPhaseId(null)}
        />
      )}

      {/* Phase 메타 정보 */}
      {activePhase && editingPhaseId !== activePhase.id && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activePhase.color }} />
            <span>{activePhase.months}개월</span>
          </span>
          {activePhase.start_date && (
            <span>
              {activePhase.start_date}
              {' → '}
              {(() => {
                const d = new Date(activePhase.start_date);
                d.setMonth(d.getMonth() + activePhase.months);
                return d.toISOString().split('T')[0];
              })()}
            </span>
          )}
          <span className="font-medium text-slate-600">
            {activePhase.categories.flatMap(c => c.items).filter(i => i.is_completed).length}
            /{activePhase.categories.flatMap(c => c.items).length} 완료
          </span>
        </div>
      )}

      {/* 카테고리 그리드 */}
      {activePhase && (
        <div className="grid grid-cols-2 gap-4">
          {activePhase.categories.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              phaseStartDate={activePhase.start_date}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEditSave={handleEditSave}
              onAddItem={handleAddItem}
              onCategoryUpdate={handleCategoryUpdate}
              onCategoryDelete={handleCategoryDelete}
            />
          ))}
          {showAddCategory && activePhase && (
            <AddCategoryForm
              phaseId={activePhase.id}
              onSave={handleCategoryCreate}
              onCancel={() => setShowAddCategory(false)}
            />
          )}
        </div>
      )}

      {/* 카테고리 추가 버튼 */}
      {activePhase && !showAddCategory && (
        <button
          onClick={() => setShowAddCategory(true)}
          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus size={15} />
          카테고리 추가
        </button>
      )}
    </div>
  );
}
