'use client';

import { useEffect, useRef, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { Plus, Trash2, Check, X, Pencil, AlertTriangle, Settings2, Loader2, CalendarClock, CheckSquare, Eye } from 'lucide-react';
import { plannerApi } from '@/lib/api';
import type { PhaseResponse, RoadmapItemResponse, ItemStatus } from '@/types';

// ─── offset ↔ date 변환 유틸 ─────────────────────────────
function calcDateToOffset(phaseStartDate: string, dateStr: string): number {
  const diffMs = new Date(dateStr).getTime() - new Date(phaseStartDate).getTime();
  if (diffMs <= 0) return 0;
  return parseFloat((diffMs / (1000 * 60 * 60 * 24 * 30.44)).toFixed(2));
}

// ─── 달력 기반 월 연산 유틸 ─────────────────────────────
function addMonthsNoOverflow(startDateStr: string, n: number): string {
  const [y, mo, d] = startDateStr.split('-').map(Number);
  const tgt = mo - 1 + n;
  const ty = y + Math.floor(tgt / 12);
  const tm = tgt % 12;
  const last = new Date(ty, tm + 1, 0).getDate();
  return new Date(ty, tm, Math.min(d, last)).toISOString().split('T')[0];
}

function calendarMonthsDiff(startDateStr: string, endDateStr: string): number {
  const [sy, sm] = startDateStr.split('-').map(Number);
  const [ey, em] = endDateStr.split('-').map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm));
}

// ─── Phase 진행률 계산 헬퍼 ─────────────────────────────
function phaseProgress(phase: PhaseResponse) {
  const items = phase.categories.flatMap(c => c.items);
  const done = items.filter(i => i.is_completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

// ─── 상태 계산 ──────────────────────────────────────────
function computeStatus(deadline: string | null, isCompleted: boolean): ItemStatus | null {
  if (isCompleted) return 'completed';
  if (!deadline) return null;
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
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEditSave: (id: number, data: { text?: string; offset?: number }) => Promise<void>;
}

function ItemRow({ item, phaseStartDate, onToggle, onDelete, onEditSave }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleDeadlineChange(val: string) {
    if (!val || !phaseStartDate || savingEdit) return;
    setSavingEdit(true);
    Promise.resolve(onEditSave(item.id, { offset: calcDateToOffset(phaseStartDate, val) }))
      .finally(() => setSavingEdit(false));
    setEditingDeadline(false);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function startEdit() {
    setDraft(item.text);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function save() {
    if (savingEdit) return;
    const next = draft.trim();
    if (next && next !== item.text) {
      setSavingEdit(true);
      try {
        await onEditSave(item.id, { text: next });
      } finally {
        setSavingEdit(false);
      }
    }
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

  async function handleToggleClick() {
    if (toggling) return;
    setToggling(true);
    try { await onToggle(item.id); } finally { setToggling(false); }
  }

  return (
    <div className={`flex items-center gap-2.5 py-2 px-2 rounded-lg group transition-colors hover:bg-slate-50 ${item.is_completed ? 'opacity-55' : ''}`}>
      <button
        onClick={handleToggleClick}
        disabled={toggling}
        className={`shrink-0 rounded-md border-2 flex items-center justify-center transition-all disabled:opacity-60 ${
          item.is_completed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 hover:border-slate-500'
        }`}
        style={{ width: 18, height: 18 }}
      >
        {toggling
          ? <Loader2 size={10} className="animate-spin text-slate-400" />
          : item.is_completed && <Check size={11} className="text-white" strokeWidth={3} />}
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
          <button onClick={save} disabled={savingEdit} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
            {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button onClick={cancel} disabled={savingEdit} className="p-1 rounded text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={14} /></button>
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
    if (val && phaseStartDate) setOffset(String(calcDateToOffset(phaseStartDate, val)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim(), deadlineDate && phaseStartDate ? calcDateToOffset(phaseStartDate, deadlineDate) : Number(offset));
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
        {phaseStartDate && offset && (
          <span className="text-[10px] text-slate-400 shrink-0">({parseFloat(Number(offset).toFixed(1))}개월 후)</span>
        )}
      </div>
    </form>
  );
}

// ─── 카테고리 카드 ────────────────────────────────────────
interface CategoryCardProps {
  cat: PhaseResponse['categories'][0];
  phaseStartDate: string | null;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEditSave: (id: number, data: { text?: string; offset?: number }) => Promise<void>;
  onAddItem: (categoryId: number, text: string, offset: number) => Promise<void>;
  onCategoryUpdate: (id: number, icon: string, title: string, subtitle: string) => Promise<boolean>;
  onCategoryDelete: (id: number) => Promise<void>;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  hideCompleted?: boolean;
}

function CategoryCard({ cat, phaseStartDate, onToggle, onDelete, onEditSave, onAddItem, onCategoryUpdate, onCategoryDelete, selectMode, isSelected, onToggleSelect, hideCompleted }: CategoryCardProps) {
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
    const ok = await onCategoryUpdate(cat.id, metaIcon.trim() || cat.icon, metaTitle.trim(), metaSubtitle.trim());
    setMetaSaving(false);
    if (ok) setEditingMeta(false);
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

  useEffect(() => {
    if (selectMode) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setPendingDelete(false);
    }
  }, [selectMode]);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all relative ${
        selectMode
          ? `cursor-pointer ${isSelected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-400'}`
          : 'border-slate-100'
      }`}
      onClick={selectMode ? () => onToggleSelect?.(cat.id) : undefined}
      role={selectMode ? 'button' : undefined}
      tabIndex={selectMode ? 0 : undefined}
      onKeyDown={selectMode ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSelect?.(cat.id); } } : undefined}
    >
      {selectMode && <div className="absolute inset-0 z-10" />}
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
              ) : selectMode ? (
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                  isSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300'
                }`}>
                  {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
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
        {cat.items
          .filter(item => !hideCompleted || !item.is_completed)
          .map(item => (
          <ItemRow
            key={item.id}
            item={item}
            phaseStartDate={phaseStartDate}
            onToggle={onToggle}
            onDelete={onDelete}
            onEditSave={onEditSave}
          />
        ))}
        {hideCompleted && cat.items.some(i => i.is_completed) && cat.items.filter(i => !i.is_completed).length === 0 && (
          <p className="text-xs text-slate-400 py-2 px-2">모두 완료됐습니다 🎉</p>
        )}
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
  onSave: (id: number, name: string, label: string, months: number, color: string) => Promise<boolean>;
  onClose: () => void;
}

function PhaseEditPanel({ phase, onSave, onClose }: PhaseEditPanelProps) {
  const [name, setName] = useState(phase.name);
  const [label, setLabel] = useState(phase.label);
  const [months, setMonths] = useState(String(phase.months));
  const [color, setColor] = useState(phase.color);
  const [saving, setSaving] = useState(false);

  // months 미변경이면 서버 end_date 사용, 변경 시 addMonthsNoOverflow로 재계산
  const computedEndDate = (() => {
    if (!phase.start_date || !months || isNaN(Number(months))) return null;
    const n = Number(months);
    if (n === phase.months && phase.end_date) return phase.end_date;
    return addMonthsNoOverflow(phase.start_date, n);
  })();

  function handleEndDateChange(val: string) {
    if (!val || !phase.start_date) return;
    setMonths(String(calendarMonthsDiff(phase.start_date, val)));
  }

  async function handleSave() {
    if (!name.trim() || !label.trim() || !months || Number(months) < 1) return;
    setSaving(true);
    const ok = await onSave(phase.id, name.trim(), label.trim(), Number(months), color);
    setSaving(false);
    if (ok) onClose();
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
          disabled={saving || !name.trim() || !label.trim() || !months || Number(months) < 1}
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<number>>(new Set());
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showDeadlineView, setShowDeadlineView] = useState(false);
  const hasAutoFocused = useRef(false);

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
      .catch((err: Error) => setError(err.message || '데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  // 최초 로드 후 is_current Phase로 자동 이동 (loadRoadmap과 분리)
  useEffect(() => {
    if (hasAutoFocused.current || phases.length === 0) return;
    const idx = phases.findIndex(p => p.is_current);
    if (idx !== -1) {
      setActiveTab(idx);
      hasAutoFocused.current = true;
    }
  }, [phases]);

  useAiRefresh(['planner'], loadRoadmap);

  async function handleSaveDate() {
    if (saving) return;
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

  async function handleToggle(id: number): Promise<void> {
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
      if (data.offset !== undefined) {
        // offset 변경 시 deadline·status가 서버에서 재계산되므로 전체 리로드
        await loadRoadmap();
      } else {
        setPhases(prev => prev.map(p => ({
          ...p,
          categories: p.categories.map(c => ({
            ...c,
            items: c.items.map(i =>
              i.id === id
                ? { ...i, ...(data.text !== undefined && { text: data.text }) }
                : i
            ),
          })),
        })));
      }
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

  async function handlePhaseUpdate(id: number, name: string, label: string, months: number, color: string): Promise<boolean> {
    try {
      await plannerApi.updatePhase(id, { name, label, months, color });
      const todayStr = new Date().toISOString().split('T')[0];
      setPhases(prev => prev.map(p => {
        if (p.id !== id) return p;
        const end_date = p.start_date ? addMonthsNoOverflow(p.start_date, months) : null;
        const is_current = !!p.start_date && !!end_date && p.start_date <= todayStr && todayStr < end_date;
        return { ...p, name, label, months, color, end_date, is_current };
      }));
      // 기간 변경 시 이후 Phase들의 start_date·deadline도 바뀌므로 전체 재조회
      await loadRoadmap();
      return true;
    } catch {
      setError('Phase 수정에 실패했습니다.');
      return false;
    }
  }

  async function handleCategoryUpdate(id: number, icon: string, title: string, subtitle: string): Promise<boolean> {
    try {
      await plannerApi.updateCategory(id, { icon, title, subtitle });
      setPhases(prev => prev.map(p => ({
        ...p,
        categories: p.categories.map(c =>
          c.id === id ? { ...c, icon, title, subtitle } : c
        ),
      })));
      return true;
    } catch {
      setError('카테고리 수정에 실패했습니다.');
      return false;
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

  function cancelSelectMode() {
    setSelectMode(false);
    setSelectedCatIds(new Set());
    setBulkDeletePending(false);
  }

  function toggleCatSelect(id: number) {
    setSelectedCatIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkCategoryDelete() {
    if (selectedCatIds.size === 0) return;
    const ids = Array.from(selectedCatIds);
    setError(null);
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map(id => plannerApi.deleteCategory(id)));
      const succeededIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (succeededIds.size > 0) {
        setPhases(prev => prev.map(p => ({
          ...p,
          categories: p.categories.filter(c => !succeededIds.has(c.id)),
        })));
      }
      if (failedCount > 0) {
        setSelectedCatIds(new Set(ids.filter((_, i) => results[i].status === 'rejected')));
        setError(`${failedCount}개 카테고리 삭제에 실패했습니다.`);
      } else {
        setSelectedCatIds(new Set());
        setSelectMode(false);
      }
    } finally {
      setBulkDeleting(false);
      setBulkDeletePending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  const activePhase = phases[activeTab] ?? phases[0];
  const allItems = phases.flatMap(p => p.categories.flatMap(c => c.items));
  const totalItems = allItems.length;
  const doneItems = allItems.filter(i => i.is_completed).length;
  const completionPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const activePhaseProg = activePhase ? phaseProgress(activePhase) : { done: 0, total: 0, pct: 0 };

  const urgentItems: UrgentItem[] = phases.flatMap(p =>
    p.categories.flatMap(c =>
      c.items
        .filter(i => i.status === 'urgent' || i.status === 'overdue')
        .map(i => ({ id: i.id, text: i.text, deadline: i.deadline!, status: i.status!, phase: p.name, category: c.title }))
    )
  ).sort((a, b) => a.deadline.localeCompare(b.deadline));

  const searchQuery = itemSearch.trim().toLowerCase();
  const searchResults = searchQuery.length >= 2
    ? phases.flatMap(p =>
        p.categories.flatMap(c =>
          c.items
            .filter(i => i.text.toLowerCase().includes(searchQuery))
            .map(i => ({ id: i.id, text: i.text, deadline: i.deadline, status: i.status, phase: p.name, category: c.title, is_completed: i.is_completed }))
        )
      )
    : [];

  // 마감일 순 미완료 항목 목록
  const deadlineSortedItems = phases.flatMap(p =>
    p.categories.flatMap(c =>
      c.items
        .filter(i => !i.is_completed && i.deadline)
        .map(i => ({ id: i.id, text: i.text, deadline: i.deadline!, status: i.status, phase: p.name, category: c.title }))
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

      {!startDate && phases.length > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <span className="shrink-0">💡</span>
          <span>오른쪽 상단에서 <strong>로드맵 시작일</strong>을 설정하면 마감일과 진행 상태가 자동으로 계산됩니다.</span>
        </div>
      )}

      {/* 전체 진행률 + Phase별 분리 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 space-y-4">
        <div>
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
        {phases.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {phases.map((phase, idx) => {
              const { done: phDone, total: phTotal, pct: phPct } = phaseProgress(phase);
              const isActive = activeTab === idx;
              return (
                <button
                  key={phase.id}
                  onClick={() => { setActiveTab(idx); setEditingPhaseId(null); setShowAddCategory(false); cancelSelectMode(); }}
                  className={`text-left rounded-xl p-2.5 transition-colors hover:bg-slate-50 ${isActive ? 'bg-slate-50 ring-1 ring-slate-200' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                    <span className="text-xs font-semibold text-slate-700 truncate">{phase.name}</span>
                    {phase.is_current && <span className="text-[9px] text-emerald-500 font-black shrink-0">●</span>}
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${phPct}%`, backgroundColor: phase.color }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{phDone}/{phTotal} · {phPct}%</span>
                </button>
              );
            })}
          </div>
        )}
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

      {/* 항목 검색 */}
      {phases.length > 0 && (
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={itemSearch}
              onChange={e => { setItemSearch(e.target.value); if (e.target.value) setShowDeadlineView(false); }}
              placeholder="항목 검색 (2자 이상)..."
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
            />
            {deadlineSortedItems.length > 0 && !searchQuery && (
              <button
                onClick={() => setShowDeadlineView(v => !v)}
                className={`px-3.5 py-2.5 rounded-xl text-sm border transition-colors shrink-0 flex items-center gap-1.5 ${
                  showDeadlineView
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                }`}
                title="마감일 순 보기"
              >
                <CalendarClock size={14} />
                <span className="hidden sm:inline text-xs font-medium">마감일 순</span>
              </button>
            )}
          </div>
          {searchQuery.length >= 2 && (
            <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden bg-white">
              {searchResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">'{itemSearch}'에 해당하는 항목이 없어요</p>
              ) : (
                <div>
                  <p className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">{searchResults.length}개 항목 발견</p>
                  {searchResults.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.is_completed ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      <span className={`flex-1 text-sm truncate ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                      {item.status && !item.is_completed && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusStyle[item.status]}`}>
                          {statusLabel[item.status]}
                        </span>
                      )}
                      {item.deadline && (
                        <span className="text-xs text-slate-400 shrink-0">{item.deadline}</span>
                      )}
                      <span className="text-[11px] text-slate-300 shrink-0 hidden sm:inline">{item.phase} / {item.category}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showDeadlineView && !searchQuery && deadlineSortedItems.length > 0 && (
            <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden bg-white">
              <p className="px-4 py-2 text-xs text-slate-400 border-b border-slate-50">
                미완료 {deadlineSortedItems.length}개 · 마감일 순
              </p>
              {deadlineSortedItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
                  <span className="flex-1 text-sm text-slate-700 truncate">{item.text}</span>
                  {item.status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${statusStyle[item.status]}`}>
                      {statusLabel[item.status]}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 shrink-0 font-medium">{item.deadline}</span>
                  <span className="text-[11px] text-slate-300 shrink-0 hidden sm:inline">{item.phase} / {item.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 탭 */}
      <div className="flex gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl">
        {phases.map((phase, idx) => {
          const { done: pDone, total: pTotal, pct: pPct } = phaseProgress(phase);
          const isActive = activeTab === idx;
          return (
            <div
              key={phase.id}
              role="button"
              tabIndex={0}
              onClick={() => { setActiveTab(idx); setEditingPhaseId(null); setShowAddCategory(false); cancelSelectMode(); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setActiveTab(idx); setEditingPhaseId(null); setShowAddCategory(false); cancelSelectMode(); } }}
              className={`flex-1 py-2.5 px-2 rounded-xl text-sm font-medium transition-all duration-200 relative group cursor-pointer select-none ${
                isActive
                  ? 'bg-white text-slate-800 shadow-sm ring-2 ring-slate-200/80'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              } ${phase.is_current && !isActive ? 'ring-1 ring-emerald-300 bg-emerald-50/50' : ''}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                <span className="truncate">{phase.name}</span>
                {isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); cancelSelectMode(); setEditingPhaseId(editingPhaseId === phase.id ? null : phase.id); }}
                    className="p-0.5 rounded text-slate-300 hover:text-slate-600 transition-colors ml-0.5"
                    title="Phase 편집"
                  >
                    <Settings2 size={12} />
                  </button>
                )}
              </div>
              <div className="text-[11px] font-normal text-slate-400">{phase.label}</div>
              <div className="text-[11px] font-normal opacity-60">{pDone}/{pTotal}</div>
              {pTotal > 0 && (
                <div className="mt-1.5 h-1 bg-slate-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pPct}%`, backgroundColor: phase.color }}
                  />
                </div>
              )}
              {phase.is_current && (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                  <span className="inline-block text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full leading-none">진행 중</span>
                  {phase.end_date && (() => {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const end = new Date(phase.end_date); end.setHours(0,0,0,0);
                    const rem = Math.ceil((end.getTime() - today.getTime()) / 86400000);
                    if (rem <= 0) return null;
                    return <span className="text-[9px] text-slate-400">D-{rem}</span>;
                  })()}
                </div>
              )}
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
        <div className="space-y-2 px-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activePhase.color }} />
              <span>{activePhase.months}개월</span>
            </span>
            {activePhase.start_date && activePhase.end_date && (
              <span>{activePhase.start_date} → {activePhase.end_date}</span>
            )}
            {activePhase.is_current && (() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const end = activePhase.end_date ? new Date(activePhase.end_date) : null;
              if (end) end.setHours(0,0,0,0);
              const rem = end ? Math.ceil((end.getTime() - today.getTime()) / 86400000) : null;
              return (
                <span className="text-emerald-600 font-semibold">
                  현재 진행 중{rem != null && rem > 0 ? ` · 종료까지 ${rem}일` : ''}
                </span>
              );
            })()}
            <span className="font-medium text-slate-600 ml-auto">
              {activePhaseProg.done}/{activePhaseProg.total} 완료 ({activePhaseProg.pct}%)
            </span>
          </div>
          {activePhaseProg.total > 0 && (
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${activePhaseProg.pct}%`, backgroundColor: activePhase.color }}
              />
            </div>
          )}
        </div>
      )}

      {/* 카테고리 선택 툴바 */}
      {activePhase && (
        <div className="flex items-center justify-between min-h-[36px]">
          {selectMode ? (
            <>
              <span className="text-sm text-slate-500">
                {selectedCatIds.size > 0 ? `${selectedCatIds.size}개 선택됨` : '카테고리를 선택하세요'}
              </span>
              <div className="flex items-center gap-2">
                {bulkDeletePending ? (
                  <>
                    <span className="text-sm font-medium text-red-500">정말 삭제할까요?</span>
                    <button
                      onClick={handleBulkCategoryDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium transition-colors"
                    >
                      {bulkDeleting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
                      확인
                    </button>
                    <button
                      onClick={() => setBulkDeletePending(false)}
                      disabled={bulkDeleting}
                      className="px-3 py-1.5 text-xs text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelSelectMode}
                      className="px-3 py-1.5 text-xs text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => setBulkDeletePending(true)}
                      disabled={selectedCatIds.size === 0}
                      className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 font-medium transition-colors"
                    >
                      선택 삭제 ({selectedCatIds.size})
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setHideCompleted(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  hideCompleted
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title={hideCompleted ? '완료 항목 보기' : '완료 항목 숨기기'}
              >
                <Eye size={13} />
                {hideCompleted ? '완료 숨김' : '전체 보기'}
              </button>
              <button
                onClick={() => { setShowAddCategory(false); setSelectMode(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 rounded-lg hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <CheckSquare size={13} />
                다중 선택
              </button>
            </div>
          )}
        </div>
      )}

      {/* 카테고리 그리드 */}
      {activePhase && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activePhase.categories.length === 0 && !showAddCategory && (
            <div className="col-span-full py-12 text-center">
              <p className="text-sm text-slate-400 mb-3">이 Phase에 카테고리가 없습니다.</p>
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                첫 카테고리 추가하기
              </button>
            </div>
          )}
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
              selectMode={selectMode}
              isSelected={selectedCatIds.has(cat.id)}
              onToggleSelect={toggleCatSelect}
              hideCompleted={hideCompleted}
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
      {activePhase && !showAddCategory && !selectMode && (
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
