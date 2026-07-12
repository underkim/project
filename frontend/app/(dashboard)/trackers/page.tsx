'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Archive, Check, ChevronRight, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import { trackersApi } from '@/lib/api';
import { showToast } from '@/lib/toast';
import Dialog from '@/components/Dialog';
import type { TrackerDetail, TrackerResponse, TrackerValueType } from '@/types';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const STARTER_TEMPLATES: Array<{ name: string; description: string; value_type: TrackerValueType; unit?: string; color: string }> = [
  { name: '운동 시간', description: '하루 동안 운동한 시간을 기록해요.', value_type: 'number', unit: '분', color: '#10b981' },
  { name: '독서량', description: '매일 읽은 분량을 기록해요.', value_type: 'number', unit: '페이지', color: '#8b5cf6' },
  { name: '오늘의 기분', description: '하루의 기분을 짧게 남겨요.', value_type: 'text', color: '#0ea5e9' },
  { name: '매일의 습관', description: '오늘 습관을 실천했는지 체크해요.', value_type: 'checkbox', color: '#f59e0b' },
];
const today = () => new Date().toISOString().slice(0, 10);

function valueLabel(type: TrackerValueType) {
  return type === 'number' ? '숫자' : type === 'checkbox' ? '완료 여부' : '짧은 글';
}

export default function TrackersPage() {
  const [trackers, setTrackers] = useState<TrackerResponse[]>([]);
  const [selected, setSelected] = useState<TrackerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [valueType, setValueType] = useState<TrackerValueType>('number');
  const [unit, setUnit] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [entryDate, setEntryDate] = useState(today());
  const [entryValue, setEntryValue] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingTracker, setEditingTracker] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editingEntry, setEditingEntry] = useState<{ id: number; value: string; note: string | null } | null>(null);
  const [editEntryValue, setEditEntryValue] = useState('');
  const [editEntryNote, setEditEntryNote] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'deleteTracker' | 'deleteEntry'; entryId?: number } | null>(null);

  const loadTrackers = useCallback(async () => {
    try {
      const list = await trackersApi.list(true);
      setTrackers(list);
      if (selected && !list.some((item) => item.id === selected.id)) setSelected(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '추적 항목을 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTrackers();
  }, [loadTrackers]);

  async function openTracker(id: number) {
    try { setSelected(await trackersApi.get(id)); }
    catch (error) { showToast(error instanceof Error ? error.message : '기록을 불러오지 못했습니다.', 'error'); }
  }

  async function createTracker(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await trackersApi.create({
        name: name.trim(), description: description.trim() || undefined,
        value_type: valueType, unit: valueType === 'number' ? unit.trim() || undefined : undefined, color,
      });
      setTrackers((current) => [created, ...current]);
      setShowCreate(false); setName(''); setDescription(''); setUnit('');
      await openTracker(created.id);
      showToast('새 추적 항목을 만들었습니다.');
    } catch (error) { showToast(error instanceof Error ? error.message : '만들지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  async function createFromTemplate(template: (typeof STARTER_TEMPLATES)[number]) {
    setSaving(true);
    try {
      const created = await trackersApi.create(template);
      await loadTrackers(); await openTracker(created.id);
      showToast(`“${template.name}” 추적을 시작했습니다.`);
    } catch (error) { showToast(error instanceof Error ? error.message : '템플릿을 추가하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const value = selected.value_type === 'checkbox' ? (entryValue || 'true') : entryValue.trim();
    if (!value) return;
    setSaving(true);
    try {
      await trackersApi.addEntry(selected.id, { entry_date: entryDate, value, note: entryNote.trim() || undefined });
      await openTracker(selected.id);
      setEntryValue(''); setEntryNote('');
      showToast('오늘의 기록을 저장했습니다.');
    } catch (error) { showToast(error instanceof Error ? error.message : '기록을 저장하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  async function restoreSelected() {
    if (!selected) return;
    await trackersApi.update(selected.id, { is_archived: false });
    setSelected(null); setShowArchived(false); await loadTrackers(); showToast('추적 항목을 복원했습니다.');
  }

  function openTrackerEditor() {
    if (!selected) return;
    setEditName(selected.name); setEditDescription(selected.description ?? ''); setEditUnit(selected.unit ?? ''); setEditingTracker(true);
  }

  async function saveTrackerEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editName.trim()) return;
    setSaving(true);
    try {
      await trackersApi.update(selected.id, { name: editName.trim(), description: editDescription.trim() || null, unit: editUnit.trim() || null });
      setEditingTracker(false); await openTracker(selected.id); await loadTrackers(); showToast('추적 항목을 수정했습니다.');
    } catch (error) { showToast(error instanceof Error ? error.message : '수정하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  function openEntryEditor(id: number, value: string, note: string | null) {
    setEditingEntry({ id, value, note }); setEditEntryValue(value); setEditEntryNote(note ?? '');
  }

  async function saveEntryEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editingEntry || !editEntryValue.trim()) return;
    setSaving(true);
    try {
      await trackersApi.updateEntry(editingEntry.id, { value: editEntryValue, note: editEntryNote.trim() || null });
      setEditingEntry(null); await openTracker(selected.id); showToast('기록을 수정했습니다.');
    } catch (error) { showToast(error instanceof Error ? error.message : '수정하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  async function executeConfirmedAction() {
    if (!selected || !confirmAction) return;
    setSaving(true);
    try {
      if (confirmAction.type === 'archive') {
        await trackersApi.update(selected.id, { is_archived: true });
        setSelected(null); showToast('추적 항목을 보관했습니다.');
      } else if (confirmAction.type === 'deleteTracker') {
        await trackersApi.remove(selected.id); setSelected(null); showToast('추적 항목을 삭제했습니다.');
      } else if (confirmAction.entryId) {
        await trackersApi.removeEntry(confirmAction.entryId); await openTracker(selected.id); showToast('기록을 삭제했습니다.');
      }
      setConfirmAction(null); await loadTrackers();
    } catch (error) { showToast(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      {editingTracker && selected && <Dialog title="추적 항목 설정" description="이름과 설명, 숫자 단위를 수정할 수 있어요." onClose={()=>setEditingTracker(false)}><form onSubmit={saveTrackerEdit} className="space-y-4"><label className="block text-sm text-slate-600">이름<input autoFocus value={editName} onChange={(e)=>setEditName(e.target.value)} maxLength={60} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900"/></label><label className="block text-sm text-slate-600">설명<input value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} maxLength={240} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label>{selected.value_type==='number'&&<label className="block text-sm text-slate-600">단위<input value={editUnit} onChange={(e)=>setEditUnit(e.target.value)} maxLength={20} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label>}<div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditingTracker(false)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">취소</button><button disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving?'저장 중...':'저장'}</button></div></form></Dialog>}

      {editingEntry && selected && <Dialog title="기록 수정" description={`${selected.name} 기록의 값과 메모를 수정합니다.`} onClose={()=>setEditingEntry(null)}><form onSubmit={saveEntryEdit} className="space-y-4">{selected.value_type==='checkbox'?<label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={editEntryValue==='true'} onChange={(e)=>setEditEntryValue(String(e.target.checked))}/>완료로 기록</label>:<label className="block text-sm text-slate-600">값{selected.unit?` (${selected.unit})`:''}<input autoFocus type={selected.value_type==='number'?'number':'text'} step="any" value={editEntryValue} onChange={(e)=>setEditEntryValue(e.target.value)} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label>}<label className="block text-sm text-slate-600">메모<input value={editEntryNote} onChange={(e)=>setEditEntryNote(e.target.value)} maxLength={500} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditingEntry(null)} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">취소</button><button disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving?'저장 중...':'저장'}</button></div></form></Dialog>}

      {confirmAction && selected && <Dialog title={confirmAction.type==='archive'?'추적 항목 보관':'삭제 확인'} description={confirmAction.type==='archive'?`“${selected.name}”을 보관합니다. 기존 기록은 유지되고 언제든 복원할 수 있어요.`:confirmAction.type==='deleteTracker'?`“${selected.name}”과 모든 기록을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.`:'선택한 기록을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.'} onClose={()=>setConfirmAction(null)}><div className="flex justify-end gap-2"><button onClick={()=>setConfirmAction(null)} disabled={saving} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50">취소</button><button onClick={executeConfirmedAction} disabled={saving} className={`rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50 ${confirmAction.type==='archive'?'bg-slate-900':'bg-red-600'}`}>{saving?'처리 중...':confirmAction.type==='archive'?'보관':'삭제'}</button></div></Dialog>}

      <header className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-900">나의 기록</h1><p className="mt-1 text-sm text-slate-500">원하는 것을 직접 정하고, 부담 없이 꾸준히 기록하세요.</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"><Plus size={16}/>추적 항목 만들기</button>
      </header>

      <section className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-800">빠르게 시작하기</h2><p className="mt-0.5 text-xs text-slate-500">자주 쓰는 예시를 선택한 뒤 이름과 단위를 자유롭게 바꿀 수 있어요.</p></div></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{STARTER_TEMPLATES.map((template)=><button key={template.name} disabled={saving} onClick={()=>createFromTemplate(template)} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-slate-400 disabled:opacity-50"><span className="mb-2 block h-2.5 w-2.5 rounded-full" style={{backgroundColor:template.color}}/><span className="block text-sm font-medium text-slate-800">{template.name}</span><span className="mt-1 block text-xs text-slate-400">{valueLabel(template.value_type)}{template.unit?` · ${template.unit}`:''}</span></button>)}</div>
      </section>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit"><button onClick={()=>{setShowArchived(false);setSelected(null);}} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${!showArchived?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>사용 중 ({trackers.filter((item)=>!item.is_archived).length})</button><button onClick={()=>{setShowArchived(true);setSelected(null);}} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${showArchived?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>보관함 ({trackers.filter((item)=>item.is_archived).length})</button></div>

      {showCreate && (
        <form onSubmit={createTracker} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex justify-between"><h2 className="font-semibold text-slate-900">무엇을 기록할까요?</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="닫기"><X size={18}/></button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-600">이름<input value={name} onChange={(e)=>setName(e.target.value)} maxLength={60} placeholder="예: 물 마시기, 기분, 독서량" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900" required/></label>
            <label className="text-sm text-slate-600">기록 방식<select value={valueType} onChange={(e)=>setValueType(e.target.value as TrackerValueType)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="number">숫자로 기록</option><option value="text">짧은 글로 기록</option><option value="checkbox">했는지 체크</option></select></label>
            <label className="text-sm text-slate-600">설명 (선택)<input value={description} onChange={(e)=>setDescription(e.target.value)} maxLength={240} placeholder="기록하려는 이유" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label>
            {valueType === 'number' && <label className="text-sm text-slate-600">단위 (선택)<input value={unit} onChange={(e)=>setUnit(e.target.value)} maxLength={20} placeholder="분, km, 페이지" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"/></label>}
          </div>
          <div className="flex gap-2">{COLORS.map((item)=><button key={item} type="button" onClick={()=>setColor(item)} aria-label={`색상 ${item}`} className={`h-8 w-8 rounded-full ${color===item?'ring-2 ring-offset-2 ring-slate-400':''}`} style={{backgroundColor:item}}/>)}</div>
          <button disabled={saving} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving?'만드는 중...':'시작하기'}</button>
        </form>
      )}

      {loading ? <div className="py-20 text-center text-sm text-slate-400">불러오는 중...</div> : trackers.filter((item)=>item.is_archived===showArchived).length === 0 && !showCreate ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center"><ListChecks className="mx-auto text-slate-300" size={36}/><h2 className="mt-4 font-semibold text-slate-800">{showArchived?'보관된 항목이 없습니다':'첫 추적 항목을 만들어보세요'}</h2><p className="mt-2 text-sm text-slate-500">{showArchived?'더 이상 사용하지 않는 항목을 보관하면 이곳에서 다시 복원할 수 있어요.':'위의 예시를 선택하거나 원하는 항목을 직접 만들 수 있어요.'}</p>{!showArchived&&<button onClick={()=>setShowCreate(true)} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white">직접 만들기</button>}</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">{trackers.filter((item)=>item.is_archived===showArchived).map((tracker)=><button key={tracker.id} onClick={()=>openTracker(tracker.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected?.id===tracker.id?'border-slate-400 bg-slate-50':'border-slate-100 hover:border-slate-300'}`}><span className="h-3 w-3 rounded-full" style={{backgroundColor:tracker.color}}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{tracker.name}</span><span className="text-xs text-slate-400">{valueLabel(tracker.value_type)}{tracker.unit?` · ${tracker.unit}`:''}</span></span><ChevronRight size={15} className="text-slate-300"/></button>)}</div>
          {!selected ? <div className="rounded-2xl bg-slate-50 py-16 text-center text-sm text-slate-500">왼쪽에서 기록할 항목을 선택하세요.</div> : <section className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>{selected.description&&<p className="mt-1 text-sm text-slate-500">{selected.description}</p>}</div><div className="flex">{selected.is_archived?<button onClick={restoreSelected} className="rounded-lg px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50">복원</button>:<><button onClick={openTrackerEditor} title="설정 수정" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><Pencil size={17}/></button><button onClick={()=>setConfirmAction({type:'archive'})} title="보관" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><Archive size={17}/></button></>}<button onClick={()=>setConfirmAction({type:'deleteTracker'})} title="완전히 삭제" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={17}/></button></div></div>
            {!selected.is_archived && <form onSubmit={addEntry} className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <label className="text-xs text-slate-500">날짜<input type="date" value={entryDate} max={today()} onChange={(e)=>setEntryDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required/></label>
              {selected.value_type==='checkbox' ? <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={entryValue==='true'} onChange={(e)=>setEntryValue(String(e.target.checked))}/><Check size={16}/>오늘 완료했어요</label> : <label className="text-xs text-slate-500">값{selected.unit?` (${selected.unit})`:''}<input type={selected.value_type==='number'?'number':'text'} step="any" value={entryValue} onChange={(e)=>setEntryValue(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required/></label>}
              <label className="text-xs text-slate-500 sm:col-span-2">메모 (선택)<input value={entryNote} onChange={(e)=>setEntryNote(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"/></label>
              <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 sm:col-span-2">기록 저장</button>
            </form>}
            <div className="mt-6"><h3 className="text-sm font-semibold text-slate-700">최근 기록</h3>{selected.entries.length===0?<p className="py-8 text-center text-sm text-slate-400">아직 기록이 없습니다.</p>:<ul className="mt-2 divide-y divide-slate-100">{selected.entries.map((entry)=><li key={entry.id} className="flex items-center gap-3 py-3"><span className="w-24 text-xs text-slate-400">{entry.entry_date}</span><span className="flex-1 text-sm text-slate-700">{selected.value_type==='checkbox'?(entry.value==='true'?'완료':'미완료'):`${entry.value}${selected.unit?` ${selected.unit}`:''}`}{entry.note&&<span className="ml-2 text-slate-400">· {entry.note}</span>}</span><button onClick={()=>openEntryEditor(entry.id, entry.value, entry.note)} aria-label="기록 수정" className="p-1 text-slate-300 hover:text-slate-600"><Pencil size={15}/></button><button onClick={()=>setConfirmAction({type:'deleteEntry',entryId:entry.id})} aria-label="기록 삭제" className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={15}/></button></li>)}</ul>}</div>
          </section>}
        </div>
      )}
    </div>
  );
}
