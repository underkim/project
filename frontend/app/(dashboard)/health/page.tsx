'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { healthApi, exportApi } from '@/lib/api';
import type { ExerciseLogResponse, SleepLogResponse, HealthSummaryResponse } from '@/types';
import { Trash2, Download, Target, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function getThisMonthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function DeleteConfirm({
  onConfirm,
  onCancel,
  disabled = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 ml-auto">
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        확인
      </button>
      <button
        onClick={onCancel}
        disabled={disabled}
        className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors"
      >
        취소
      </button>
    </span>
  );
}

const PAGE = 20;

export default function HealthPage() {
  const [summary, setSummary] = useState<HealthSummaryResponse | null>(null);
  const [exercises, setExercises] = useState<ExerciseLogResponse[]>([]);
  const [sleeps, setSleeps] = useState<SleepLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exHasMore, setExHasMore] = useState(false);
  const [slHasMore, setSlHasMore] = useState(false);
  const [exLoadMore, setExLoadMore] = useState(false);
  const [slLoadMore, setSlLoadMore] = useState(false);

  const [exForm, setExForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    exercise_type: '',
    duration_minutes: '',
    note: '',
  });
  const [slForm, setSlForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    sleep_hours: '',
    quality: '3',
    note: '',
  });
  const [showEx, setShowEx] = useState(false);
  const [showSl, setShowSl] = useState(false);
  const [deletingEx, setDeletingEx] = useState<number | null>(null);
  const [deletingSl, setDeletingSl] = useState<number | null>(null);
  const [editingEx, setEditingEx] = useState<{
    id: number;
    exercise_type: string;
    duration_minutes: string;
    note: string;
  } | null>(null);
  const [editingSl, setEditingSl] = useState<{
    id: number;
    sleep_hours: string;
    quality: string;
    note: string;
  } | null>(null);
  const [exMonthFilter, setExMonthFilter] = useState<string>('all');
  const [slMonthFilter, setSlMonthFilter] = useState<string>('all');

  const EX_GOAL_KEY = 'exercise_weekly_goal';
  const [exWeekGoal, setExWeekGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(EX_GOAL_KEY) ?? '0', 10) || 0;
  });
  const [editingExGoal, setEditingExGoal] = useState(false);
  const [exGoalInput, setExGoalInput] = useState('');

  const SL_GOAL_KEY = 'sleep_nightly_goal';
  const [slNightlyGoal, setSlNightlyGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseFloat(localStorage.getItem(SL_GOAL_KEY) ?? '0') || 0;
  });
  const [editingSlGoal, setEditingSlGoal] = useState(false);
  const [slGoalInput, setSlGoalInput] = useState('');
  const [exporting, setExporting] = useState<Set<string>>(new Set());

  // "YYYY-MM" 필터 값을 CSV 내보내기용 날짜 범위로 변환 ('all'이면 전체 범위)
  function monthFilterToRange(
    monthFilter: string,
  ): { start_date: string; end_date: string } | undefined {
    if (monthFilter === 'all') return undefined;
    const [y, m] = monthFilter.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start_date: `${monthFilter}-01`,
      end_date: `${monthFilter}-${String(lastDay).padStart(2, '0')}`,
    };
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

  const [mutating, setMutating] = useState<Set<string>>(new Set());

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

  async function load() {
    setLoadError(false);
    try {
      const [s, ex, sl] = await Promise.all([
        healthApi.getSummary(),
        healthApi.listExercise(60),
        healthApi.listSleep(30),
      ]);
      setSummary(s);
      setExercises(ex);
      setExHasMore(ex.length === 60);
      setSleeps(sl);
      setSlHasMore(sl.length === 30);
    } catch {
      setLoadError(true);
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreEx() {
    setExLoadMore(true);
    try {
      const more = await healthApi.listExercise(PAGE, exercises.length);
      setExercises((prev) => [...prev, ...more]);
      setExHasMore(more.length === PAGE);
    } catch {
      showToast('불러오지 못했습니다.', 'error');
    } finally {
      setExLoadMore(false);
    }
  }

  async function loadMoreSl() {
    setSlLoadMore(true);
    try {
      const more = await healthApi.listSleep(PAGE, sleeps.length);
      setSleeps((prev) => [...prev, ...more]);
      setSlHasMore(more.length === PAGE);
    } catch {
      showToast('불러오지 못했습니다.', 'error');
    } finally {
      setSlLoadMore(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useAiRefresh(['health'], load);

  async function submitExercise(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('ex_create', async () => {
      try {
        await healthApi.createExercise({
          log_date: exForm.log_date,
          exercise_type: exForm.exercise_type,
          duration_minutes: Number(exForm.duration_minutes),
          note: exForm.note || undefined,
        });
        setExForm((f) => ({ ...f, exercise_type: '', duration_minutes: '', note: '' }));
        setShowEx(false);
        showToast('운동 기록 저장됨');
        await load();
      } catch {
        showToast('저장에 실패했습니다.', 'error');
      }
    });
  }

  async function submitSleep(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('sl_create', async () => {
      try {
        await healthApi.createSleep({
          log_date: slForm.log_date,
          sleep_hours: Number(slForm.sleep_hours),
          quality: Number(slForm.quality),
          note: slForm.note || undefined,
        });
        setSlForm((f) => ({ ...f, sleep_hours: '', quality: '3', note: '' }));
        setShowSl(false);
        showToast('수면 기록 저장됨');
        await load();
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        showToast(
          status === 409 ? '이미 해당 날짜의 수면 기록이 있어요.' : '저장에 실패했습니다.',
          'error',
        );
      }
    });
  }

  async function updateExercise() {
    if (!editingEx) return;
    await withMutation('ex_edit', async () => {
      try {
        await healthApi.updateExercise(editingEx.id, {
          exercise_type: editingEx.exercise_type,
          duration_minutes: Number(editingEx.duration_minutes),
          note: editingEx.note || null,
        });
        setEditingEx(null);
        showToast('운동 기록 수정됨');
        await load();
      } catch {
        showToast('수정에 실패했습니다.', 'error');
      }
    });
  }

  async function deleteExercise(id: number) {
    await withMutation(`ex_delete_${id}`, async () => {
      try {
        await healthApi.deleteExercise(id);
        setDeletingEx(null);
        showToast('운동 기록 삭제됨');
        await load();
      } catch {
        showToast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  async function updateSleep() {
    if (!editingSl) return;
    await withMutation('sl_edit', async () => {
      try {
        await healthApi.updateSleep(editingSl.id, {
          sleep_hours: Number(editingSl.sleep_hours),
          quality: Number(editingSl.quality),
          note: editingSl.note || null,
        });
        setEditingSl(null);
        showToast('수면 기록 수정됨');
        await load();
      } catch {
        showToast('수정에 실패했습니다.', 'error');
      }
    });
  }

  async function deleteSleep(id: number) {
    await withMutation(`sl_delete_${id}`, async () => {
      try {
        await healthApi.deleteSleep(id);
        setDeletingSl(null);
        showToast('수면 기록 삭제됨');
        await load();
      } catch {
        showToast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  const last7 = getLast7Days();
  const exerciseByDay: Record<string, number> = Object.fromEntries(last7.map((d) => [d, 0]));
  exercises.forEach((ex) => {
    if (ex.log_date in exerciseByDay) exerciseByDay[ex.log_date] += ex.duration_minutes;
  });
  const exerciseChartData = last7.map((d) => ({ date: d.slice(5), 분: exerciseByDay[d] }));

  const sleepByDay: Record<string, { hours?: number }> = Object.fromEntries(
    last7.map((d) => [d, {}]),
  );
  sleeps.forEach((sl) => {
    if (sl.log_date in sleepByDay) sleepByDay[sl.log_date] = { hours: sl.sleep_hours };
  });
  const sleepChartData = last7.map((d) => ({
    date: d.slice(5),
    수면: sleepByDay[d].hours ?? null,
  }));
  const hasSleepData = sleepChartData.some((d) => d.수면 !== null);

  // 이번 달 운동 통계
  const monthPrefix = getThisMonthPrefix();
  const thisMonthEx = exercises.filter((ex) => ex.log_date.startsWith(monthPrefix));
  const thisMonthDays = new Set(thisMonthEx.map((ex) => ex.log_date)).size;
  const thisMonthMins = thisMonthEx.reduce((s, ex) => s + ex.duration_minutes, 0);

  // 수면 30일 추이 (로드된 sleeps는 최신순 정렬)
  const sleep30ChartData = [...sleeps]
    .reverse()
    .slice(-30)
    .map((sl) => ({ date: sl.log_date.slice(5), 수면: sl.sleep_hours, 품질: sl.quality }));
  const avgSleepHours =
    sleeps.length > 0
      ? Math.round((sleeps.reduce((s, sl) => s + sl.sleep_hours, 0) / sleeps.length) * 10) / 10
      : null;

  // 수면 요일별 평균 (최근 30개 기록 기준)
  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
  const sleepByDow = sleeps
    .slice(0, 30)
    .reduce<Record<number, { sum: number; count: number }>>((acc, sl) => {
      const dow = new Date(sl.log_date + 'T12:00:00').getDay();
      if (!acc[dow]) acc[dow] = { sum: 0, count: 0 };
      acc[dow].sum += sl.sleep_hours;
      acc[dow].count += 1;
      return acc;
    }, {});
  const sleepDowData = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: DOW_LABELS[d],
    avg: sleepByDow[d] ? Math.round((sleepByDow[d].sum / sleepByDow[d].count) * 10) / 10 : null,
    isWeekend: d === 0 || d === 6,
  }));
  const hasDowData = sleepDowData.some((d) => d.avg !== null);

  // 운동 요일별 패턴 (전체 기록 기준, 요일별 총 분 합계)
  const exByDow = exercises.reduce<Record<number, number>>((acc, ex) => {
    const dow = new Date(ex.log_date + 'T12:00:00').getDay();
    acc[dow] = (acc[dow] ?? 0) + ex.duration_minutes;
    return acc;
  }, {});
  const exDowData = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: DOW_LABELS[d],
    mins: exByDow[d] ?? 0,
    isWeekend: d === 0 || d === 6,
  }));
  const maxExDowMins = Math.max(...exDowData.map((d) => d.mins), 1);
  const hasExDowData = exDowData.some((d) => d.mins > 0);

  // 월별 운동 통계 (운동 일수 + 총 분)
  const exMonthlyData = (() => {
    const map: Record<string, { days: Set<string>; mins: number }> = {};
    exercises.forEach((ex) => {
      const mo = ex.log_date.slice(0, 7);
      if (!map[mo]) map[mo] = { days: new Set(), mins: 0 };
      map[mo].days.add(ex.log_date);
      map[mo].mins += ex.duration_minutes;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mo, v]) => ({ month: mo.slice(5), 일수: v.days.size, 분: v.mins }));
  })();

  // 월별 수면 평균
  const sleepMonthlyData = (() => {
    const map: Record<string, { sum: number; count: number }> = {};
    sleeps.forEach((sl) => {
      const mo = sl.log_date.slice(0, 7);
      if (!map[mo]) map[mo] = { sum: 0, count: 0 };
      map[mo].sum += sl.sleep_hours;
      map[mo].count += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mo, v]) => ({ month: mo.slice(5), 평균: Math.round((v.sum / v.count) * 10) / 10 }));
  })();

  // 수면 질 vs 시간 상관관계 (최근 30개 기록, quality > 0인 것만)
  const sleepScatter = sleeps.slice(0, 30).filter((sl) => sl.quality > 0);
  const hasSleepScatter = sleepScatter.length >= 5;
  const scatterMinHours = hasSleepScatter
    ? Math.max(0, Math.min(...sleepScatter.map((s) => s.sleep_hours)) - 0.5)
    : 0;
  const scatterMaxHours = hasSleepScatter
    ? Math.max(...sleepScatter.map((s) => s.sleep_hours)) + 0.5
    : 10;
  const scatterHoursRange = scatterMaxHours - scatterMinHours || 1;

  // 운동 종류별 누적
  const exByType = exercises.reduce<Record<string, number>>((acc, ex) => {
    const key = ex.exercise_type.toLowerCase();
    acc[key] = (acc[key] ?? 0) + ex.duration_minutes;
    return acc;
  }, {});
  const topTypes = Object.entries(exByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // 운동 달력 히트맵 (최근 16주)
  const exHeatmap = (() => {
    const dayMins: Record<string, number> = {};
    exercises.forEach((ex) => {
      dayMins[ex.log_date] = (dayMins[ex.log_date] ?? 0) + ex.duration_minutes;
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const startDow = today.getDay();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - startDow));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 111);
    const days: { date: string; mins: number; isToday: boolean }[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      days.push({ date: ds, mins: dayMins[ds] ?? 0, isToday: ds === todayStr });
    }
    return days;
  })();
  const hasExHeatmap = exercises.length >= 5;

  // 수면 시간 분포 히스토그램
  const sleepBins = [
    { label: '~6h', min: 0, max: 6 },
    { label: '6~7h', min: 6, max: 7 },
    { label: '7~8h', min: 7, max: 8 },
    { label: '8~9h', min: 8, max: 9 },
    { label: '9h~', min: 9, max: Infinity },
  ];
  const sleepHistData = sleepBins.map((bin) => ({
    label: bin.label,
    count: sleeps.filter((sl) => sl.sleep_hours >= bin.min && sl.sleep_hours < bin.max).length,
    isIdeal: bin.min >= 7 && bin.max <= 9,
  }));
  const maxSleepBinCount = Math.max(...sleepHistData.map((b) => b.count), 1);
  const hasSleepHist = sleeps.length >= 5;

  function saveExGoal() {
    const v = parseInt(exGoalInput, 10);
    if (v > 0 && v <= 7) {
      localStorage.setItem(EX_GOAL_KEY, String(v));
      setExWeekGoal(v);
    }
    setEditingExGoal(false);
  }

  function saveSlGoal() {
    const v = parseFloat(slGoalInput);
    if (v >= 1 && v <= 24) {
      localStorage.setItem(SL_GOAL_KEY, String(v));
      setSlNightlyGoal(v);
    }
    setEditingSlGoal(false);
  }

  // 연속 운동 일수 계산
  const exStreak = (() => {
    const dates = [...new Set(exercises.map((ex) => ex.log_date))].sort();
    if (dates.length === 0) return { current: 0, best: 0 };
    // build streaks
    const streaks: number[] = [];
    let run = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round(
        (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000,
      );
      if (diff === 1) run++;
      else {
        streaks.push(run);
        run = 1;
      }
    }
    streaks.push(run);
    const best = Math.max(...streaks);
    // current streak: count back from latest date if it was today or yesterday
    const today = new Date().toISOString().slice(0, 10);
    const yd = new Date(today);
    yd.setDate(yd.getDate() - 1);
    const yesterday = yd.toISOString().slice(0, 10);
    const last = dates[dates.length - 1];
    const current = last === today || last === yesterday ? streaks[streaks.length - 1] : 0;
    return { current, best };
  })();

  const exMonths = [...new Set(exercises.map((ex) => ex.log_date.slice(0, 7)))].sort().reverse();
  const filteredExercises =
    exMonthFilter === 'all'
      ? exercises
      : exercises.filter((ex) => ex.log_date.startsWith(exMonthFilter));
  const slMonths = [...new Set(sleeps.map((sl) => sl.log_date.slice(0, 7)))].sort().reverse();
  const filteredSleeps =
    slMonthFilter === 'all' ? sleeps : sleeps.filter((sl) => sl.log_date.startsWith(slMonthFilter));

  const qualityLabels = ['', '최악', '나쁨', '보통', '좋음', '최고'];
  const qualityColors = [
    '',
    'bg-red-100 text-red-600',
    'bg-orange-100 text-orange-600',
    'bg-slate-100 text-slate-600',
    'bg-emerald-100 text-emerald-700',
    'bg-emerald-200 text-emerald-800',
  ];
  const inputCls =
    'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900';

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">건강</h1>

      {loadError && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            데이터를 불러오지 못했습니다.
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

      {/* 요약 — 이번 주 + 이번 달 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-slate-100 rounded-xl px-4 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">이번 주 운동</p>
            {editingExGoal ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={exGoalInput}
                  onChange={(e) => setExGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveExGoal();
                    if (e.key === 'Escape') setEditingExGoal(false);
                  }}
                  className="w-10 text-xs border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  placeholder="일"
                />
                <button onClick={saveExGoal} className="text-xs text-blue-600 font-medium">
                  확인
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setExGoalInput(String(exWeekGoal || ''));
                  setEditingExGoal(true);
                }}
                className="text-slate-300 hover:text-slate-500 transition-colors"
                title="주간 목표 설정"
              >
                <Target size={12} />
              </button>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary?.exercise_days_this_week ?? 0}일
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {summary?.total_exercise_minutes_this_week ?? 0}분
          </p>
          {exWeekGoal > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round(((summary?.exercise_days_this_week ?? 0) / exWeekGoal) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">목표 {exWeekGoal}일</p>
            </div>
          )}
        </div>
        <div className="border border-slate-100 rounded-xl px-4 py-4">
          <p className="text-xs text-slate-400 mb-1.5">이번 달 운동</p>
          <p className="text-2xl font-semibold text-slate-900">{thisMonthDays}일</p>
          <p className="text-xs text-slate-400 mt-1">
            {thisMonthMins >= 60
              ? `${Math.floor(thisMonthMins / 60)}h ${thisMonthMins % 60}m`
              : `${thisMonthMins}분`}
          </p>
        </div>
        <div className="border border-slate-100 rounded-xl px-4 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">이번 주 평균 수면</p>
            {editingSlGoal ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={slGoalInput}
                  onChange={(e) => setSlGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSlGoal();
                    if (e.key === 'Escape') setEditingSlGoal(false);
                  }}
                  className="w-12 text-xs border border-slate-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  placeholder="h"
                />
                <button onClick={saveSlGoal} className="text-xs text-blue-600 font-medium">
                  확인
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSlGoalInput(String(slNightlyGoal || ''));
                  setEditingSlGoal(true);
                }}
                className="text-slate-300 hover:text-slate-500 transition-colors"
                title="목표 수면 시간 설정"
              >
                <Target size={12} />
              </button>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary?.avg_sleep_hours_this_week != null
              ? `${summary.avg_sleep_hours_this_week}h`
              : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            품질{' '}
            {summary?.avg_sleep_quality_this_week != null
              ? `${summary.avg_sleep_quality_this_week}/5`
              : '—'}
          </p>
          {slNightlyGoal > 0 && summary?.avg_sleep_hours_this_week != null && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((summary.avg_sleep_hours_this_week / slNightlyGoal) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">목표 {slNightlyGoal}h</p>
            </div>
          )}
        </div>
        <div className="border border-slate-100 rounded-xl px-4 py-4">
          <p className="text-xs text-slate-400 mb-1.5">운동 스트릭</p>
          {exStreak.current > 0 ? (
            <div>
              <p className="text-2xl font-semibold text-slate-900">{exStreak.current}일</p>
              <p className="text-xs text-slate-400 mt-1">연속 운동 중</p>
              {exStreak.best > exStreak.current && (
                <p className="text-[10px] text-slate-300 mt-0.5">최장 {exStreak.best}일</p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-2xl font-semibold text-slate-300">—</p>
              {exStreak.best > 0 && (
                <p className="text-xs text-slate-400 mt-1">최장 기록 {exStreak.best}일</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 차트 — 이번 주 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
            이번 주 운동 (분)
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={exerciseChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v) => [`${v}분`, '운동']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="분" fill="#0f172a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {hasSleepData ? (
          <div className="border border-slate-100 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
              이번 주 수면 (시간)
            </p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={sleepChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis domain={[0, 12]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(v) => (v !== null ? [`${v}시간`, '수면'] : ['미기록', '수면'])}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="수면"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  dot={{ r: 2.5, fill: '#0f172a' }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="border border-slate-100 rounded-xl p-5 flex items-center justify-center">
            <p className="text-slate-400 text-sm text-center">
              수면 기록을 추가하면
              <br />
              추이 차트가 표시됩니다
            </p>
          </div>
        )}
      </div>

      {/* 수면 30일 추이 */}
      {sleep30ChartData.length >= 7 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              수면 추이 (시간)
            </p>
            {avgSleepHours != null && (
              <span className="text-xs text-slate-400">평균 {avgSleepHours}h</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={sleep30ChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
              />
              <YAxis domain={[0, 12]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                formatter={(v, name) =>
                  name === '수면' ? [`${v}시간`, '수면'] : [`${v}/5`, '품질']
                }
                contentStyle={{ fontSize: 12 }}
              />
              {avgSleepHours != null && (
                <ReferenceLine y={avgSleepHours} stroke="#94a3b8" strokeDasharray="4 4" />
              )}
              <Line
                type="monotone"
                dataKey="수면"
                stroke="#0f172a"
                strokeWidth={1.5}
                dot={{ r: 2, fill: '#0f172a' }}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 수면 요일별 패턴 */}
      {hasDowData && sleeps.length >= 7 && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              요일별 평균 수면 (최근 30일)
            </p>
            {avgSleepHours != null && (
              <span className="text-xs text-slate-400">전체 평균 {avgSleepHours}h</span>
            )}
          </div>
          <div className="flex items-end gap-2 justify-between">
            {sleepDowData.map(({ day, avg, isWeekend }) => {
              const pct =
                avg != null && avgSleepHours
                  ? Math.min(100, Math.round((avg / Math.max(avgSleepHours * 1.3, 10)) * 100))
                  : 0;
              const isLow = avg != null && avgSleepHours != null && avg < avgSleepHours - 0.5;
              const isHigh = avg != null && avgSleepHours != null && avg > avgSleepHours + 0.5;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400">
                    {avg != null ? `${avg}h` : '—'}
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        avg == null
                          ? 'bg-slate-50'
                          : isHigh
                            ? 'bg-indigo-400'
                            : isLow
                              ? 'bg-rose-300'
                              : isWeekend
                                ? 'bg-slate-400'
                                : 'bg-slate-300'
                      }`}
                      style={{ height: avg != null ? `${pct}%` : '4px' }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-medium ${isWeekend ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-300 mt-2">
            <span className="inline-block w-2 h-2 rounded-sm bg-rose-300 mr-1 align-middle" />
            평균보다 낮음
            <span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 mx-1 ml-3 align-middle" />
            평균보다 높음
          </p>
        </div>
      )}

      {/* 수면 질 vs 시간 상관관계 */}
      {hasSleepScatter && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
            수면 시간 vs 품질 (최근 30일)
          </p>
          <div className="relative" style={{ height: 120 }}>
            {/* Y축 라벨 (품질 1-5) */}
            <div
              className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-slate-300 pr-1"
              style={{ width: 20 }}
            >
              {[5, 4, 3, 2, 1].map((q) => (
                <span key={q}>{q}</span>
              ))}
            </div>
            {/* 플롯 영역 */}
            <div className="absolute inset-0 ml-5">
              {/* 수평 격자선 */}
              {[1, 2, 3, 4, 5].map((q) => (
                <div
                  key={q}
                  className="absolute w-full border-t border-slate-50"
                  style={{ bottom: `${((q - 1) / 4) * 100}%` }}
                />
              ))}
              {/* 데이터 점 */}
              {sleepScatter.map((sl) => {
                const x = ((sl.sleep_hours - scatterMinHours) / scatterHoursRange) * 100;
                const y = ((sl.quality - 1) / 4) * 100;
                const qColors = [
                  '',
                  'bg-red-400',
                  'bg-orange-400',
                  'bg-slate-400',
                  'bg-emerald-400',
                  'bg-emerald-600',
                ];
                return (
                  <div
                    key={sl.id}
                    className={`absolute w-2 h-2 rounded-full opacity-70 ${qColors[sl.quality]}`}
                    style={{ left: `${x}%`, bottom: `${y}%`, transform: 'translate(-50%, 50%)' }}
                    title={`${sl.sleep_hours}h · 품질 ${sl.quality}`}
                  />
                );
              })}
            </div>
          </div>
          {/* X축 라벨 */}
          <div className="flex justify-between text-[9px] text-slate-300 mt-1 ml-5">
            <span>{scatterMinHours.toFixed(1)}h</span>
            <span className="text-slate-400">수면 시간</span>
            <span>{scatterMaxHours.toFixed(1)}h</span>
          </div>
        </div>
      )}

      {/* 수면 시간 분포 */}
      {hasSleepHist && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
            수면 시간 분포 ({sleeps.length}회)
          </p>
          <div className="flex items-end gap-2 justify-between">
            {sleepHistData.map(({ label, count, isIdeal }) => {
              const pct = Math.round((count / maxSleepBinCount) * 100);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400">{count > 0 ? count : '—'}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        count === 0 ? 'bg-slate-50' : isIdeal ? 'bg-indigo-400' : 'bg-slate-200'
                      }`}
                      style={{ height: count > 0 ? `${Math.max(pct, 5)}%` : '4px' }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            권장(7~9h){' '}
            <span className="inline-block w-2 h-2 rounded-sm bg-indigo-400 align-middle mx-0.5" /> ·
            기타{' '}
            <span className="inline-block w-2 h-2 rounded-sm bg-slate-200 align-middle mx-0.5" />
          </p>
        </div>
      )}

      {/* 운동 요일별 패턴 */}
      {hasExDowData && exercises.length >= 5 && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              요일별 누적 운동 (분)
            </p>
            <span className="text-xs text-slate-400">
              최다: {exDowData.reduce((a, b) => (a.mins > b.mins ? a : b)).day}요일
            </span>
          </div>
          <div className="flex items-end gap-2 justify-between">
            {exDowData.map(({ day, mins, isWeekend }) => {
              const pct = Math.round((mins / maxExDowMins) * 100);
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400">{mins > 0 ? `${mins}` : '—'}</span>
                  <div className="w-full flex flex-col justify-end" style={{ height: 60 }}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        mins === 0
                          ? 'bg-slate-50'
                          : pct === 100
                            ? 'bg-emerald-500'
                            : isWeekend
                              ? 'bg-emerald-300'
                              : 'bg-emerald-200'
                      }`}
                      style={{ height: mins > 0 ? `${Math.max(pct, 5)}%` : '4px' }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-medium ${isWeekend ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 운동 달력 히트맵 */}
      {hasExHeatmap && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              운동 활동 (최근 16주)
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>없음</span>
              {['bg-slate-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600'].map(
                (c, i) => (
                  <span key={i} className={`inline-block w-3 h-3 rounded-sm ${c}`} />
                ),
              )}
              <span>많음</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: 16 }, (_, weekIdx) => {
              const weekDays = exHeatmap.slice(weekIdx * 7, weekIdx * 7 + 7);
              return (
                <div key={weekIdx} className="flex flex-col gap-1 shrink-0">
                  {weekDays.map(({ date, mins, isToday }) => {
                    const colorCls =
                      mins === 0
                        ? 'bg-slate-100'
                        : mins <= 30
                          ? 'bg-emerald-200'
                          : mins <= 60
                            ? 'bg-emerald-400'
                            : 'bg-emerald-600';
                    return (
                      <div
                        key={date}
                        className={`w-3.5 h-3.5 rounded-sm ${colorCls} ${isToday ? 'ring-1 ring-emerald-400 ring-offset-1' : ''}`}
                        title={`${date}: ${mins > 0 ? `${mins}분` : '운동 없음'}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 운동 종류별 분포 */}
      {topTypes.length > 0 && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">
            운동 종류별 누적
          </p>
          <div className="space-y-2">
            {topTypes.map(([type, mins]) => {
              const maxMins = topTypes[0][1];
              const pct = Math.round((mins / maxMins) * 100);
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16 shrink-0 capitalize">{type}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right shrink-0">{mins}분</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 월별 운동·수면 추이 */}
      {(exMonthlyData.length >= 2 || sleepMonthlyData.length >= 2) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {exMonthlyData.length >= 2 && (
            <div className="border border-slate-100 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
                월별 운동 일수
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={exMonthlyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v}일`, '운동']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="일수" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {sleepMonthlyData.length >= 2 && (
            <div className="border border-slate-100 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">
                월별 평균 수면 (시간)
              </p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart
                  data={sleepMonthlyData}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(v) => [`${v}h`, '평균 수면']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  {avgSleepHours && (
                    <ReferenceLine
                      y={avgSleepHours}
                      stroke="#cbd5e1"
                      strokeDasharray="4 2"
                      label={{
                        value: `평균 ${avgSleepHours}h`,
                        position: 'insideTopRight',
                        fontSize: 9,
                        fill: '#94a3b8',
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="평균"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 운동 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">운동 기록</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleExport('exercise', () =>
                  exportApi.exercise(monthFilterToRange(exMonthFilter)),
                )
              }
              disabled={exporting.has('exercise')}
              title="CSV 내보내기"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting.has('exercise') ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
            <button
              onClick={() => setShowEx(!showEx)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              + 추가
            </button>
          </div>
        </div>
        {/* 월 필터 */}
        {exMonths.length > 1 && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-50 overflow-x-auto">
            {(['all', ...exMonths] as const).map((m) => (
              <button
                key={m}
                onClick={() => setExMonthFilter(m)}
                className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors ${exMonthFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {m === 'all' ? '전체' : m}
              </button>
            ))}
          </div>
        )}
        {showEx && (
          <form
            onSubmit={submitExercise}
            className="px-5 py-4 bg-slate-50 border-b border-slate-100"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input
                  type="date"
                  value={exForm.log_date}
                  onChange={(e) => setExForm({ ...exForm, log_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">종류</label>
                <input
                  type="text"
                  value={exForm.exercise_type}
                  placeholder="러닝, 헬스..."
                  onChange={(e) => setExForm({ ...exForm, exercise_type: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (분)</label>
                <input
                  type="number"
                  value={exForm.duration_minutes}
                  min="1"
                  onChange={(e) => setExForm({ ...exForm, duration_minutes: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <input
                  type="text"
                  value={exForm.note}
                  placeholder="오늘 운동 내용 또는 느낌..."
                  onChange={(e) => setExForm({ ...exForm, note: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowEx(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={mutating.has('ex_create')}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutating.has('ex_create') && <Loader2 size={13} className="animate-spin" />}저장
              </button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {exercises.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 운동 기록이 없어요</p>
              <button
                onClick={() => setShowEx(true)}
                className="mt-2 text-xs text-slate-500 underline underline-offset-2"
              >
                첫 기록 추가하기
              </button>
            </div>
          ) : (
            filteredExercises.map((ex) =>
              editingEx?.id === ex.id ? (
                <div key={ex.id} className="px-5 py-3 bg-blue-50 border-l-2 border-blue-400">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <input
                      type="text"
                      value={editingEx.exercise_type}
                      onChange={(e) =>
                        setEditingEx({ ...editingEx, exercise_type: e.target.value })
                      }
                      placeholder="운동 종류"
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="number"
                      value={editingEx.duration_minutes}
                      min="1"
                      onChange={(e) =>
                        setEditingEx({ ...editingEx, duration_minutes: e.target.value })
                      }
                      placeholder="분"
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="text"
                      value={editingEx.note}
                      onChange={(e) => setEditingEx({ ...editingEx, note: e.target.value })}
                      placeholder="메모"
                      className="text-sm border border-slate-200 rounded px-2 py-1 col-span-2 sm:col-span-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={updateExercise}
                      disabled={mutating.has('ex_edit')}
                      className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mutating.has('ex_edit') && <Loader2 size={11} className="animate-spin" />}
                      저장
                    </button>
                    <button
                      onClick={() => setEditingEx(null)}
                      className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={ex.id}
                  className="flex items-start px-5 py-3 gap-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                  onClick={() => {
                    if (deletingEx !== ex.id)
                      setEditingEx({
                        id: ex.id,
                        exercise_type: ex.exercise_type,
                        duration_minutes: String(ex.duration_minutes),
                        note: ex.note ?? '',
                      });
                  }}
                >
                  <span className="text-slate-400 text-xs w-24 shrink-0 mt-0.5">{ex.log_date}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                      {ex.exercise_type}
                    </span>
                    {ex.note && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{ex.note}</p>
                    )}
                  </div>
                  <span className="text-slate-500 text-sm shrink-0">{ex.duration_minutes}분</span>
                  {deletingEx === ex.id ? (
                    <DeleteConfirm
                      onConfirm={() => deleteExercise(ex.id)}
                      onCancel={() => setDeletingEx(null)}
                      disabled={mutating.has(`ex_delete_${ex.id}`)}
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingEx(ex.id);
                      }}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ),
            )
          )}
          {exHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button
                onClick={loadMoreEx}
                disabled={exLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
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
            <button
              onClick={() =>
                handleExport('sleep', () => exportApi.sleep(monthFilterToRange(slMonthFilter)))
              }
              disabled={exporting.has('sleep')}
              title="CSV 내보내기"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting.has('sleep') ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
            <button
              onClick={() => setShowSl(!showSl)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              + 추가
            </button>
          </div>
        </div>
        {showSl && (
          <form onSubmit={submitSleep} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] text-slate-400 mb-3">날짜당 1개 기록만 가능합니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input
                  type="date"
                  value={slForm.log_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSlForm({ ...slForm, log_date: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">수면 시간</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={slForm.sleep_hours}
                  onChange={(e) => setSlForm({ ...slForm, sleep_hours: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">품질 (1-5)</label>
                <select
                  value={slForm.quality}
                  onChange={(e) => setSlForm({ ...slForm, quality: e.target.value })}
                  className={inputCls}
                >
                  {[5, 4, 3, 2, 1].map((q) => (
                    <option key={q} value={q}>
                      {q} — {qualityLabels[q]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <input
                  type="text"
                  value={slForm.note}
                  placeholder="수면 특이사항..."
                  onChange={(e) => setSlForm({ ...slForm, note: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowSl(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={mutating.has('sl_create')}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutating.has('sl_create') && <Loader2 size={13} className="animate-spin" />}저장
              </button>
            </div>
          </form>
        )}
        {slMonths.length > 1 && (
          <div className="px-5 py-2.5 border-b border-slate-50 flex gap-1.5 overflow-x-auto bg-slate-50/50">
            {(['all', ...slMonths] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSlMonthFilter(m)}
                className={`text-[11px] px-2.5 py-1 rounded-full shrink-0 transition-colors ${slMonthFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {m === 'all' ? '전체' : m}
              </button>
            ))}
          </div>
        )}
        <div className="divide-y divide-slate-50">
          {sleeps.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 수면 기록이 없어요</p>
              <button
                onClick={() => setShowSl(true)}
                className="mt-2 text-xs text-slate-500 underline underline-offset-2"
              >
                첫 기록 추가하기
              </button>
            </div>
          ) : (
            filteredSleeps.map((sl) =>
              editingSl?.id === sl.id ? (
                <div key={sl.id} className="px-5 py-3 bg-blue-50 border-l-2 border-blue-400">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={editingSl.sleep_hours}
                      onChange={(e) => setEditingSl({ ...editingSl, sleep_hours: e.target.value })}
                      placeholder="시간"
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <select
                      value={editingSl.quality}
                      onChange={(e) => setEditingSl({ ...editingSl, quality: e.target.value })}
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {[5, 4, 3, 2, 1].map((q) => (
                        <option key={q} value={q}>
                          {qualityLabels[q]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={editingSl.note}
                      onChange={(e) => setEditingSl({ ...editingSl, note: e.target.value })}
                      placeholder="메모"
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={updateSleep}
                      disabled={mutating.has('sl_edit')}
                      className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mutating.has('sl_edit') && <Loader2 size={11} className="animate-spin" />}
                      저장
                    </button>
                    <button
                      onClick={() => setEditingSl(null)}
                      className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={sl.id}
                  className="flex items-start px-5 py-3 gap-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                  onClick={() => {
                    if (deletingSl !== sl.id)
                      setEditingSl({
                        id: sl.id,
                        sleep_hours: String(sl.sleep_hours),
                        quality: String(sl.quality),
                        note: sl.note ?? '',
                      });
                  }}
                >
                  <span className="text-slate-400 text-xs w-24 shrink-0 mt-0.5">{sl.log_date}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                        {sl.sleep_hours}시간
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${qualityColors[sl.quality]}`}
                      >
                        {qualityLabels[sl.quality]}
                      </span>
                    </div>
                    {sl.note && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sl.note}</p>
                    )}
                  </div>
                  {deletingSl === sl.id ? (
                    <DeleteConfirm
                      onConfirm={() => deleteSleep(sl.id)}
                      onCancel={() => setDeletingSl(null)}
                      disabled={mutating.has(`sl_delete_${sl.id}`)}
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingSl(sl.id);
                      }}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ),
            )
          )}
          {slHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button
                onClick={loadMoreSl}
                disabled={slLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                {slLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
