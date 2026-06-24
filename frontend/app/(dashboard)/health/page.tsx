'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { healthApi, exportApi } from '@/lib/api';
import type { ExerciseLogResponse, SleepLogResponse, HealthSummaryResponse } from '@/types';
import { Trash2, Download } from 'lucide-react';

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="flex items-center gap-1 ml-auto">
      <button onClick={onConfirm} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">확인</button>
      <button onClick={onCancel} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors">취소</button>
    </span>
  );
}

const PAGE = 20;

export default function HealthPage() {
  const [summary, setSummary] = useState<HealthSummaryResponse | null>(null);
  const [exercises, setExercises] = useState<ExerciseLogResponse[]>([]);
  const [sleeps, setSleeps] = useState<SleepLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [exHasMore, setExHasMore] = useState(false);
  const [slHasMore, setSlHasMore] = useState(false);
  const [exLoadMore, setExLoadMore] = useState(false);
  const [slLoadMore, setSlLoadMore] = useState(false);

  const [exForm, setExForm] = useState({ log_date: '', exercise_type: '', duration_minutes: '', note: '' });
  const [slForm, setSlForm] = useState({ log_date: '', sleep_hours: '', quality: '3', note: '' });
  const [showEx, setShowEx] = useState(false);
  const [showSl, setShowSl] = useState(false);
  const [deletingEx, setDeletingEx] = useState<number | null>(null);
  const [deletingSl, setDeletingSl] = useState<number | null>(null);

  async function load() {
    try {
      const [s, ex, sl] = await Promise.all([
        healthApi.getSummary(), healthApi.listExercise(30), healthApi.listSleep(PAGE),
      ]);
      setSummary(s);
      setExercises(ex); setExHasMore(ex.length === 30);
      setSleeps(sl); setSlHasMore(sl.length === PAGE);
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreEx() {
    setExLoadMore(true);
    try {
      const more = await healthApi.listExercise(PAGE, exercises.length);
      setExercises(prev => [...prev, ...more]);
      setExHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setExLoadMore(false); }
  }

  async function loadMoreSl() {
    setSlLoadMore(true);
    try {
      const more = await healthApi.listSleep(PAGE, sleeps.length);
      setSleeps(prev => [...prev, ...more]);
      setSlHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setSlLoadMore(false); }
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setExForm(f => ({ ...f, log_date: today }));
    setSlForm(f => ({ ...f, log_date: today }));
    load();
  }, []);

  useAiRefresh(['health'], load);

  async function submitExercise(e: React.FormEvent) {
    e.preventDefault();
    try {
      await healthApi.createExercise({
        log_date: exForm.log_date, exercise_type: exForm.exercise_type,
        duration_minutes: Number(exForm.duration_minutes), note: exForm.note || undefined,
      });
      setExForm(f => ({ ...f, exercise_type: '', duration_minutes: '', note: '' }));
      setShowEx(false);
      showToast('운동 기록 저장됨');
      await load();
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    }
  }

  async function submitSleep(e: React.FormEvent) {
    e.preventDefault();
    try {
      await healthApi.createSleep({
        log_date: slForm.log_date, sleep_hours: Number(slForm.sleep_hours),
        quality: Number(slForm.quality), note: slForm.note || undefined,
      });
      setSlForm(f => ({ ...f, sleep_hours: '', quality: '3', note: '' }));
      setShowSl(false);
      showToast('수면 기록 저장됨');
      await load();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      showToast(status === 409 ? '이미 해당 날짜의 수면 기록이 있어요.' : '저장에 실패했습니다.', 'error');
    }
  }

  async function deleteExercise(id: number) {
    try {
      await healthApi.deleteExercise(id);
      setDeletingEx(null);
      showToast('운동 기록 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  async function deleteSleep(id: number) {
    try {
      await healthApi.deleteSleep(id);
      setDeletingSl(null);
      showToast('수면 기록 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  const last7 = getLast7Days();
  const exerciseByDay: Record<string, number> = Object.fromEntries(last7.map(d => [d, 0]));
  exercises.forEach(ex => { if (ex.log_date in exerciseByDay) exerciseByDay[ex.log_date] += ex.duration_minutes; });
  const exerciseChartData = last7.map(d => ({ date: d.slice(5), 분: exerciseByDay[d] }));

  const sleepByDay: Record<string, { hours?: number }> = Object.fromEntries(last7.map(d => [d, {}]));
  sleeps.forEach(sl => { if (sl.log_date in sleepByDay) sleepByDay[sl.log_date] = { hours: sl.sleep_hours }; });
  const sleepChartData = last7.map(d => ({ date: d.slice(5), 수면: sleepByDay[d].hours ?? null }));
  const hasSleepData = sleepChartData.some(d => d.수면 !== null);

  const qualityLabels = ['', '최악', '나쁨', '보통', '좋음', '최고'];
  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">건강</h1>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">이번 주 운동</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.exercise_days_this_week ?? 0}일</p>
          <p className="text-xs text-slate-400 mt-1">{summary?.total_exercise_minutes_this_week ?? 0}분</p>
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">이번 주 평균 수면</p>
          <p className="text-2xl font-semibold text-slate-900">
            {summary?.avg_sleep_hours_this_week != null ? `${summary.avg_sleep_hours_this_week}h` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            품질 {summary?.avg_sleep_quality_this_week != null ? `${summary.avg_sleep_quality_this_week}/5` : '—'}
          </p>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">이번 주 운동 (분)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={exerciseChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={v => [`${v}분`, '운동']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="분" fill="#0f172a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {hasSleepData ? (
          <div className="border border-slate-100 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">이번 주 수면 (시간)</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={sleepChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={v => v !== null ? [`${v}시간`, '수면'] : ['미기록', '수면']} contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="수면" stroke="#0f172a" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: '#0f172a' }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl p-5 flex items-center justify-center">
            <p className="text-slate-400 text-sm text-center">수면 기록을 추가하면<br />추이 차트가 표시됩니다</p>
          </div>
        )}
      </div>

      {/* 운동 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">운동 기록</p>
          <div className="flex items-center gap-2">
          <button onClick={() => exportApi.exercise()} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <Download size={14} />
          </button>
          <button onClick={() => setShowEx(!showEx)}
            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
            + 추가
          </button>
          </div>
        </div>
        {showEx && (
          <form onSubmit={submitExercise} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" value={exForm.log_date}
                  onChange={e => setExForm({ ...exForm, log_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">종류</label>
                <input type="text" value={exForm.exercise_type} placeholder="러닝, 헬스..."
                  onChange={e => setExForm({ ...exForm, exercise_type: e.target.value })}
                  className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (분)</label>
                <input type="number" value={exForm.duration_minutes} min="1"
                  onChange={e => setExForm({ ...exForm, duration_minutes: e.target.value })}
                  className={inputCls} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowEx(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">저장</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {exercises.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 운동 기록이 없어요</p>
              <button onClick={() => setShowEx(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
            </div>
          ) : exercises.map(ex => (
            <div key={ex.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors">
              <span className="text-slate-400 text-xs w-24 shrink-0">{ex.log_date}</span>
              <span className="font-medium text-sm text-slate-700">{ex.exercise_type}</span>
              <span className="text-slate-500 text-sm">{ex.duration_minutes}분</span>
              {ex.note && <span className="text-slate-400 text-xs hidden sm:block truncate">{ex.note}</span>}
              {deletingEx === ex.id ? (
                <DeleteConfirm onConfirm={() => deleteExercise(ex.id)} onCancel={() => setDeletingEx(null)} />
              ) : (
                <button onClick={() => setDeletingEx(ex.id)} className="ml-auto text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {exHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreEx} disabled={exLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {exLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 수면 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">수면 기록</p>
          <div className="flex items-center gap-2">
          <button onClick={() => exportApi.sleep()} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <Download size={14} />
          </button>
          <button onClick={() => setShowSl(!showSl)}
            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
            + 추가
          </button>
          </div>
        </div>
        {showSl && (
          <form onSubmit={submitSleep} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" value={slForm.log_date}
                  onChange={e => setSlForm({ ...slForm, log_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">수면 시간</label>
                <input type="number" step="0.5" min="0.5" max="24" value={slForm.sleep_hours}
                  onChange={e => setSlForm({ ...slForm, sleep_hours: e.target.value })}
                  className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">품질 (1-5)</label>
                <select value={slForm.quality}
                  onChange={e => setSlForm({ ...slForm, quality: e.target.value })}
                  className={inputCls}>
                  {[5, 4, 3, 2, 1].map(q => <option key={q} value={q}>{q} — {qualityLabels[q]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowSl(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">저장</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {sleeps.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 수면 기록이 없어요</p>
              <button onClick={() => setShowSl(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
            </div>
          ) : sleeps.map(sl => (
            <div key={sl.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors">
              <span className="text-slate-400 text-xs w-24 shrink-0">{sl.log_date}</span>
              <span className="font-medium text-sm text-slate-700">{sl.sleep_hours}시간</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                sl.quality >= 4 ? 'bg-slate-100 text-slate-700' : sl.quality <= 2 ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {qualityLabels[sl.quality]}
              </span>
              {deletingSl === sl.id ? (
                <DeleteConfirm onConfirm={() => deleteSleep(sl.id)} onCancel={() => setDeletingSl(null)} />
              ) : (
                <button onClick={() => setDeletingSl(sl.id)} className="ml-auto text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {slHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreSl} disabled={slLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {slLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
