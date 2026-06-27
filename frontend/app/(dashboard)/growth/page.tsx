'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { growthApi, exportApi } from '@/lib/api';
import type { BookRecordResponse, EnglishLogResponse, GrowthSummaryResponse, BookStatus } from '@/types';
import { Trash2, Download, Star, Target, Loader2 } from 'lucide-react';

const statusConfig: Record<BookStatus, { label: string; color: string }> = {
  planned:   { label: '예정',   color: 'bg-slate-100 text-slate-600' },
  reading:   { label: '읽는 중', color: 'bg-slate-200 text-slate-700' },
  completed: { label: '완독',   color: 'bg-slate-900 text-white' },
  wishlist:  { label: '읽고 싶음', color: 'bg-violet-100 text-violet-700' },
};

const activityLabels: Record<string, string> = {
  reading: '읽기', listening: '듣기', speaking: '말하기', writing: '쓰기', vocab: '단어',
};

function DeleteConfirm({ onConfirm, onCancel, disabled = false }: { onConfirm: () => void; onCancel: () => void; disabled?: boolean }) {
  return (
    <span className="flex items-center gap-1 ml-auto">
      <button onClick={onConfirm} disabled={disabled} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">확인</button>
      <button onClick={onCancel} disabled={disabled} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors">취소</button>
    </span>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i === value ? 0 : i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5"
        >
          <Star
            size={16}
            className={`transition-colors ${i <= (hovered || value) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
          />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={10} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
      ))}
    </div>
  );
}

const PAGE = 20;

export default function GrowthPage() {
  const [summary, setSummary] = useState<GrowthSummaryResponse | null>(null);
  const [books, setBooks] = useState<BookRecordResponse[]>([]);
  const [englishLogs, setEnglishLogs] = useState<EnglishLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [booksHasMore, setBooksHasMore] = useState(false);
  const [engHasMore, setEngHasMore] = useState(false);
  const [booksLoadMore, setBooksLoadMore] = useState(false);
  const [engLoadMore, setEngLoadMore] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showEngForm, setShowEngForm] = useState(false);
  const [deletingBook, setDeletingBook] = useState<number | null>(null);
  const [deletingEng, setDeletingEng] = useState<number | null>(null);
  const [bookSearch, setBookSearch] = useState('');
  const [bookStatusFilter, setBookStatusFilter] = useState<'all' | 'reading' | 'completed' | 'wishlist'>('all');
  const [engMonthFilter, setEngMonthFilter] = useState<string>('all');
  const [editingBook, setEditingBook] = useState<{ id: number; title: string; author: string; note: string; rating: string; start_date: string; end_date: string } | null>(null);
  const [editingEng, setEditingEng] = useState<{ id: number; activity_type: string; duration_minutes: string; note: string } | null>(null);
  const [bookYearFilter, setBookYearFilter] = useState<string>('all');

  const YEAR = new Date().getFullYear();
  const MONTH = new Date().getMonth() + 1;
  const GOAL_KEY = `book_goal_${YEAR}`;
  const ENG_GOAL_KEY = `eng_goal_${YEAR}_${MONTH}`;
  const [bookGoal, setBookGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(GOAL_KEY) ?? '0', 10) || 0;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [engGoal, setEngGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(ENG_GOAL_KEY) ?? '0', 10) || 0;
  });
  const [editingEngGoal, setEditingEngGoal] = useState(false);
  const [engGoalInput, setEngGoalInput] = useState('');
  const [exporting, setExporting] = useState<Set<string>>(new Set());

  async function handleExport(key: string, fn: () => Promise<void>) {
    if (exporting.has(key)) return;
    setExporting(prev => new Set(prev).add(key));
    try { await fn(); } finally {
      setExporting(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  const [mutating, setMutating] = useState<Set<string>>(new Set());

  async function withMutation(key: string, fn: () => Promise<void>) {
    if (mutating.has(key)) return;
    setMutating(prev => new Set(prev).add(key));
    try { await fn(); } finally {
      setMutating(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  const [bookForm, setBookForm] = useState({
    title: '', author: '', status: 'planned' as BookStatus,
    rating: 0, note: '', start_date: '', end_date: '',
  });
  const [engForm, setEngForm] = useState({ log_date: '', activity_type: 'reading', duration_minutes: '', note: '' });

  async function load() {
    try {
      const [s, b, e] = await Promise.all([
        growthApi.getSummary(), growthApi.listBooks(PAGE), growthApi.listEnglish(PAGE),
      ]);
      setSummary(s);
      setBooks(b); setBooksHasMore(b.length === PAGE);
      setEnglishLogs(e); setEngHasMore(e.length === PAGE);
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreBooks() {
    setBooksLoadMore(true);
    try {
      const more = await growthApi.listBooks(PAGE, books.length);
      setBooks(prev => [...prev, ...more]);
      setBooksHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setBooksLoadMore(false); }
  }

  async function loadMoreEng() {
    setEngLoadMore(true);
    try {
      const more = await growthApi.listEnglish(PAGE, englishLogs.length);
      setEnglishLogs(prev => [...prev, ...more]);
      setEngHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setEngLoadMore(false); }
  }

  useEffect(() => {
    setEngForm(f => ({ ...f, log_date: new Date().toISOString().slice(0, 10) }));
    load();
  }, []);

  useAiRefresh(['growth'], load);

  async function submitBook(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('book_create', async () => {
      try {
        await growthApi.createBook({
          title: bookForm.title,
          author: bookForm.author || undefined,
          status: bookForm.status,
          rating: bookForm.rating || undefined,
          note: bookForm.note || undefined,
          start_date: bookForm.start_date || undefined,
          end_date: bookForm.end_date || undefined,
        });
        setBookForm({ title: '', author: '', status: 'planned', rating: 0, note: '', start_date: '', end_date: '' });
        setShowBookForm(false);
        showToast('책 추가됨');
        await load();
      } catch {
        showToast('저장에 실패했습니다.', 'error');
      }
    });
  }

  async function updateBookStatus(id: number, status: BookStatus) {
    await withMutation(`book_status_${id}`, async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const updates: Record<string, string | undefined> = { status };
        if (status === 'reading') updates.start_date = today;
        if (status === 'completed') updates.end_date = today;
        await growthApi.updateBook(id, updates);
        showToast(status === 'completed' ? '완독 달성! 🎉' : '상태 변경됨');
        await load();
      } catch {
        showToast('상태 변경에 실패했습니다.', 'error');
      }
    });
  }

  async function saveBookEdit() {
    if (!editingBook) return;
    await withMutation('book_edit', async () => {
      try {
        const rating = parseInt(editingBook.rating, 10);
        await growthApi.updateBook(editingBook.id, {
          title: editingBook.title,
          author: editingBook.author || null,
          note: editingBook.note || null,
          rating: rating > 0 && rating <= 5 ? rating : null,
          start_date: editingBook.start_date || null,
          end_date: editingBook.end_date || null,
        });
        setEditingBook(null);
        showToast('책 정보 수정됨');
        await load();
      } catch {
        showToast('수정에 실패했습니다.', 'error');
      }
    });
  }

  async function deleteBook(id: number) {
    await withMutation(`book_delete_${id}`, async () => {
      try {
        await growthApi.deleteBook(id);
        setDeletingBook(null);
        showToast('책 삭제됨');
        await load();
      } catch {
        showToast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  async function submitEng(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('eng_create', async () => {
      try {
        await growthApi.createEnglish({
          log_date: engForm.log_date, activity_type: engForm.activity_type,
          duration_minutes: Number(engForm.duration_minutes), note: engForm.note || undefined,
        });
        setEngForm(f => ({ ...f, duration_minutes: '', note: '' }));
        setShowEngForm(false);
        showToast('영어 학습 기록 저장됨');
        await load();
      } catch {
        showToast('저장에 실패했습니다.', 'error');
      }
    });
  }

  async function saveEngEdit() {
    if (!editingEng) return;
    await withMutation('eng_edit', async () => {
      try {
        await growthApi.updateEnglish(editingEng.id, {
          activity_type: editingEng.activity_type,
          duration_minutes: Number(editingEng.duration_minutes),
          note: editingEng.note || null,
        });
        setEditingEng(null);
        showToast('영어 기록 수정됨');
        await load();
      } catch {
        showToast('수정에 실패했습니다.', 'error');
      }
    });
  }

  async function deleteEnglish(id: number) {
    await withMutation(`eng_delete_${id}`, async () => {
      try {
        await growthApi.deleteEnglish(id);
        setDeletingEng(null);
        showToast('영어 기록 삭제됨');
        await load();
      } catch {
        showToast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  function saveGoal() {
    const v = parseInt(goalInput, 10);
    if (v > 0) { localStorage.setItem(GOAL_KEY, String(v)); setBookGoal(v); }
    setEditingGoal(false);
  }

  function saveEngGoal() {
    const v = parseInt(engGoalInput, 10);
    if (v > 0) { localStorage.setItem(ENG_GOAL_KEY, String(v)); setEngGoal(v); }
    setEditingEngGoal(false);
  }

  // 책 연도 목록 (end_date 기준, completed만)
  const bookYears = [...new Set(
    books.filter(b => b.status === 'completed' && b.end_date).map(b => b.end_date!.slice(0, 4))
  )].sort().reverse();

  // 책 검색/필터
  const filteredBooks = books.filter(b => {
    const matchStatus = bookStatusFilter === 'all' || b.status === bookStatusFilter;
    const q = bookSearch.trim().toLowerCase();
    const matchSearch = !q || b.title.toLowerCase().includes(q) || (b.author ?? '').toLowerCase().includes(q);
    const matchYear = bookYearFilter === 'all' || (b.status === 'completed' && (b.end_date ?? '').startsWith(bookYearFilter));
    return matchStatus && matchSearch && (bookYearFilter === 'all' || matchYear);
  });

  // 완독 책 평균 평점 계산
  const ratedBooks = books.filter(b => b.status === 'completed' && b.rating != null);
  const avgRating = ratedBooks.length > 0
    ? ratedBooks.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedBooks.length
    : null;

  // 완독 소요 기간 통계 (start_date, end_date 모두 있는 책)
  const booksWithDuration = books
    .filter(b => b.status === 'completed' && b.start_date && b.end_date)
    .map(b => ({
      ...b,
      days: Math.round((new Date(b.end_date!).getTime() - new Date(b.start_date!).getTime()) / 86400000) + 1,
    }))
    .filter(b => b.days > 0);
  const avgReadDays = booksWithDuration.length > 0
    ? Math.round(booksWithDuration.reduce((s, b) => s + b.days, 0) / booksWithDuration.length)
    : null;
  const fastestBook = booksWithDuration.length > 0
    ? booksWithDuration.reduce((a, b) => a.days < b.days ? a : b)
    : null;

  // 영어 학습 유형별 분 합계
  const engByType = englishLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.activity_type] = (acc[log.activity_type] ?? 0) + log.duration_minutes;
    return acc;
  }, {});

  const engMinutesTotal = summary?.english_minutes_this_month ?? 0;
  const engMonths = [...new Set(englishLogs.map(l => l.log_date.slice(0, 7)))].sort().reverse();
  const filteredEngLogs = engMonthFilter === 'all' ? englishLogs : englishLogs.filter(l => l.log_date.startsWith(engMonthFilter));
  const engHours = Math.floor(engMinutesTotal / 60);
  const engMins = engMinutesTotal % 60;

  // 영어 학습 연속 일수 streak
  const engStreak = (() => {
    const dates = [...new Set(englishLogs.map(l => l.log_date))].sort();
    if (dates.length === 0) return { current: 0, best: 0 };
    const streaks: number[] = [];
    let run = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round(
        (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000
      );
      if (diff === 1) run++;
      else { streaks.push(run); run = 1; }
    }
    streaks.push(run);
    const best = Math.max(...streaks);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last = dates[dates.length - 1];
    const current = (last === today || last === yesterday) ? streaks[streaks.length - 1] : 0;
    return { current, best };
  })();

  // 월별 완독 수 (최근 12개월)
  const booksMonthly = (() => {
    const counts: Record<string, number> = {};
    books.filter(b => b.status === 'completed' && b.end_date).forEach(b => {
      const mo = b.end_date!.slice(0, 7);
      counts[mo] = (counts[mo] ?? 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, count]) => ({ month: month.slice(5), 완독: count }));
  })();

  // 월별 영어 학습 시간 (분, 최근 12개월)
  const engMonthlyMins = (() => {
    const totals: Record<string, number> = {};
    englishLogs.forEach(l => {
      const mo = l.log_date.slice(0, 7);
      totals[mo] = (totals[mo] ?? 0) + l.duration_minutes;
    });
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, mins]) => ({ month: month.slice(5), 분: mins }));
  })();

  // 영어 학습 히트맵 (최근 16주 = 112일)
  const engHeatmap = (() => {
    const dayMins: Record<string, number> = {};
    englishLogs.forEach(l => {
      dayMins[l.log_date] = (dayMins[l.log_date] ?? 0) + l.duration_minutes;
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const endDate = new Date(today);
    const startDow = today.getDay();
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
  const hasEngHeatmap = englishLogs.length >= 3;

  // 독서 페이스 예측
  const bookPacePrediction = (() => {
    if (!bookGoal) return null;
    const completedThisYear = summary?.books_completed_this_year ?? 0;
    const remaining = bookGoal - completedThisYear;
    if (remaining <= 0) return null;
    const monthsLeft = 12 - MONTH + 1;
    if (monthsLeft <= 0) return null;
    const neededPerMonth = Math.ceil(remaining / monthsLeft);
    const monthsElapsed = MONTH - 1 || 1;
    const currentMonthlyPace = completedThisYear > 0
      ? Math.round((completedThisYear / monthsElapsed) * 10) / 10
      : null;
    const projectedTotal = currentMonthlyPace != null
      ? Math.round(completedThisYear + currentMonthlyPace * monthsLeft)
      : null;
    return { remaining, monthsLeft, neededPerMonth, currentMonthlyPace, projectedTotal };
  })();

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white';

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">자기계발</h1>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">올해 완독</p>
            {!editingGoal ? (
              <button onClick={() => { setGoalInput(bookGoal > 0 ? String(bookGoal) : ''); setEditingGoal(true); }}
                className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                <Target size={10} />
                {bookGoal > 0 ? `목표 ${bookGoal}권` : '목표 설정'}
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input type="number" min="1" max="365" value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                  autoFocus
                  className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="권" />
                <button onClick={saveGoal} className="text-slate-500 hover:text-slate-900 text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">확인</button>
              </div>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summary?.books_completed_this_year ?? 0}권</p>
          {bookGoal > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>{summary?.books_completed_this_year ?? 0} / {bookGoal}권</span>
                <span>{Math.min(100, Math.round(((summary?.books_completed_this_year ?? 0) / bookGoal) * 100))}%</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((summary?.books_completed_this_year ?? 0) / bookGoal) * 100))}%` }} />
              </div>
            </div>
          )}
          {bookPacePrediction && (
            <div className="mt-2 text-[10px] text-slate-400 space-y-0.5">
              <p>
                {bookPacePrediction.monthsLeft}개월 남음 · 달성하려면 월{' '}
                <span className="font-semibold text-violet-600">{bookPacePrediction.neededPerMonth}권</span> 필요
              </p>
              {bookPacePrediction.currentMonthlyPace != null && bookPacePrediction.projectedTotal != null && (
                <p>
                  현재 페이스({bookPacePrediction.currentMonthlyPace}권/월) 유지 시{' '}
                  <span className={`font-semibold ${bookPacePrediction.projectedTotal >= bookGoal ? 'text-emerald-600' : 'text-amber-500'}`}>
                    약 {bookPacePrediction.projectedTotal}권
                  </span>{' '}
                  예상
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-slate-400">
              읽는 중 {summary?.books_reading ?? 0}권
              {(summary?.books_wishlist ?? 0) > 0 && (
                <span className="ml-2 text-violet-400">· 찜 {summary!.books_wishlist}권</span>
              )}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {avgRating != null && (
                <div className="flex items-center gap-1">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs text-slate-500">{avgRating.toFixed(1)}</span>
                </div>
              )}
              {avgReadDays != null && (
                <span className="text-xs text-slate-400">
                  평균 <span className="font-medium text-slate-600">{avgReadDays}일</span> 소요
                </span>
              )}
              {fastestBook && (
                <span className="text-xs text-slate-400" title={`최단: ${fastestBook.title}`}>
                  최단 {fastestBook.days}일
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">이번 달 영어</p>
            {editingEngGoal ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="1" max="31"
                  value={engGoalInput}
                  onChange={e => setEngGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEngGoal(); if (e.key === 'Escape') setEditingEngGoal(false); }}
                  className="w-14 text-xs border border-slate-300 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                  autoFocus
                  placeholder="일"
                />
                <button onClick={saveEngGoal} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
              </div>
            ) : (
              <button onClick={() => { setEngGoalInput(String(engGoal || '')); setEditingEngGoal(true); }} className="text-slate-300 hover:text-slate-500 transition-colors" title="월간 목표 설정">
                <Target size={13} />
              </button>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">{summary?.english_days_this_month ?? 0}일</p>
          <p className="text-xs text-slate-400 mt-1">
            {engHours > 0 ? `${engHours}시간 ` : ''}{engMins > 0 || engHours === 0 ? `${engMins}분` : ''}
          </p>
          {engStreak.current > 0 && (
            <p className="text-[10px] text-blue-500 font-medium mt-1">🔥 {engStreak.current}일 연속</p>
          )}
          {engStreak.current === 0 && engStreak.best > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">최장 {engStreak.best}일 연속</p>
          )}
          {engGoal > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>목표 {engGoal}일</span>
                <span>{Math.min(100, Math.round(((summary?.english_days_this_month ?? 0) / engGoal) * 100))}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min(100, Math.round(((summary?.english_days_this_month ?? 0) / engGoal) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 영어 학습 히트맵 (최근 16주) */}
      {hasEngHeatmap && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">영어 학습 활동 (최근 16주)</p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>적음</span>
              {['bg-slate-100', 'bg-violet-200', 'bg-violet-400', 'bg-violet-600'].map((c, i) => (
                <span key={i} className={`inline-block w-3 h-3 rounded-sm ${c}`} />
              ))}
              <span>많음</span>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Array.from({ length: 16 }, (_, weekIdx) => {
              const weekDays = engHeatmap.slice(weekIdx * 7, weekIdx * 7 + 7);
              return (
                <div key={weekIdx} className="flex flex-col gap-1 shrink-0">
                  {weekDays.map(({ date, mins, isToday }) => {
                    const colorCls =
                      mins === 0 ? 'bg-slate-100' :
                      mins <= 30 ? 'bg-violet-200' :
                      mins <= 60 ? 'bg-violet-400' :
                      'bg-violet-600';
                    return (
                      <div
                        key={date}
                        className={`w-3.5 h-3.5 rounded-sm ${colorCls} ${isToday ? 'ring-1 ring-violet-400 ring-offset-1' : ''}`}
                        title={`${date}: ${mins > 0 ? `${mins}분` : '학습 없음'}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 영어 학습 유형별 분포 (이번 달 로그 기반) */}
      {Object.keys(engByType).length > 0 && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">영어 학습 유형별 누적</p>
          <div className="space-y-2">
            {Object.entries(engByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, mins]) => {
                const maxMins = Math.max(...Object.values(engByType));
                const pct = Math.round((mins / maxMins) * 100);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-14 shrink-0">{activityLabels[type] ?? type}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right shrink-0">{mins}분</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 월별 차트 */}
      {(booksMonthly.length >= 2 || engMonthlyMins.length >= 2) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {booksMonthly.length >= 2 && (
            <div className="border border-slate-100 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">월별 완독</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={booksMonthly} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v}권`, '완독']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="완독" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {engMonthlyMins.length >= 2 && (
            <div className="border border-slate-100 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">월별 영어 학습 (분)</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={engMonthlyMins} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(v) => [`${v}분`, '영어']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="분" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* 독서 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">독서 목록</p>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('books', exportApi.books)} disabled={exporting.has('books')} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {exporting.has('books') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
            <button onClick={() => setShowBookForm(!showBookForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
              + 추가
            </button>
          </div>
        </div>
        {/* 검색 + 필터 */}
        <div className="px-5 py-2.5 border-b border-slate-50 flex flex-wrap items-center gap-2 bg-slate-50/50">
          <input
            type="text" value={bookSearch} onChange={e => setBookSearch(e.target.value)}
            placeholder="제목·저자 검색..." className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'reading', 'completed', 'wishlist'] as const).map(s => (
              <button key={s} onClick={() => { setBookStatusFilter(s); if (s !== 'completed') setBookYearFilter('all'); }}
                className={`text-[11px] px-2 py-1 rounded-full transition-colors ${bookStatusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s === 'all' ? '전체' : s === 'reading' ? '읽는 중' : s === 'completed' ? '완독' : '읽고 싶음'}
              </button>
            ))}
            {bookStatusFilter === 'completed' && bookYears.length > 1 && (
              <>
                <span className="text-slate-200 text-[11px]">|</span>
                {(['all', ...bookYears] as const).map(y => (
                  <button key={y} onClick={() => setBookYearFilter(y)}
                    className={`text-[11px] px-2 py-1 rounded-full transition-colors ${bookYearFilter === y ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-500 hover:bg-violet-100'}`}>
                    {y === 'all' ? '전체' : y}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        {showBookForm && (
          <form onSubmit={submitBook} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">제목</label>
                <input type="text" value={bookForm.title}
                  onChange={e => setBookForm({ ...bookForm, title: e.target.value })}
                  className={inputCls} required placeholder="책 제목" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">저자</label>
                <input type="text" value={bookForm.author}
                  onChange={e => setBookForm({ ...bookForm, author: e.target.value })}
                  className={inputCls} placeholder="저자명" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">상태</label>
                <select value={bookForm.status}
                  onChange={e => setBookForm({ ...bookForm, status: e.target.value as BookStatus })}
                  className={inputCls}>
                  <option value="planned">예정</option>
                  <option value="reading">읽는 중</option>
                  <option value="completed">완독</option>
                  <option value="wishlist">읽고 싶음</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                <input type="date" value={bookForm.start_date}
                  onChange={e => setBookForm({ ...bookForm, start_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">완독일</label>
                <input type="date" value={bookForm.end_date}
                  onChange={e => setBookForm({ ...bookForm, end_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">평점</label>
                <StarRating value={bookForm.rating} onChange={v => setBookForm({ ...bookForm, rating: v })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <input type="text" value={bookForm.note}
                  onChange={e => setBookForm({ ...bookForm, note: e.target.value })}
                  className={inputCls} placeholder="한 줄 감상..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowBookForm(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" disabled={mutating.has('book_create')} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {mutating.has('book_create') && <Loader2 size={13} className="animate-spin" />}저장
              </button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {books.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 등록된 책이 없어요</p>
              <button onClick={() => setShowBookForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 책 추가하기</button>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-400 text-sm">조건에 맞는 책이 없어요</p>
              <button onClick={() => { setBookSearch(''); setBookStatusFilter('all'); setBookYearFilter('all'); }} className="mt-2 text-xs text-slate-500 underline underline-offset-2">필터 초기화</button>
            </div>
          ) : filteredBooks.map(book => (
            editingBook?.id === book.id ? (
              <div key={book.id} className="px-5 py-3 bg-blue-50 border-l-2 border-blue-400">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <input type="text" value={editingBook.title}
                    onChange={e => setEditingBook({ ...editingBook, title: e.target.value })}
                    placeholder="제목" className="text-sm border border-slate-200 rounded px-2 py-1 col-span-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <input type="text" value={editingBook.author}
                    onChange={e => setEditingBook({ ...editingBook, author: e.target.value })}
                    placeholder="저자" className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 shrink-0">별점</span>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={() => setEditingBook({ ...editingBook, rating: String(s) })}
                        className={`text-lg leading-none ${parseInt(editingBook.rating) >= s ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
                    ))}
                  </div>
                  <input type="date" value={editingBook.start_date}
                    onChange={e => setEditingBook({ ...editingBook, start_date: e.target.value })}
                    className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <input type="date" value={editingBook.end_date}
                    onChange={e => setEditingBook({ ...editingBook, end_date: e.target.value })}
                    className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <input type="text" value={editingBook.note}
                    onChange={e => setEditingBook({ ...editingBook, note: e.target.value })}
                    placeholder="메모" className="text-sm border border-slate-200 rounded px-2 py-1 col-span-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveBookEdit} disabled={mutating.has('book_edit')} className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{mutating.has('book_edit') && <Loader2 size={11} className="animate-spin" />}저장</button>
                  <button onClick={() => setEditingBook(null)} className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700">취소</button>
                </div>
              </div>
            ) : (
              <div key={book.id} className="flex items-start px-5 py-3 gap-3 hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => { if (deletingBook !== book.id) setEditingBook({ id: book.id, title: book.title, author: book.author ?? '', note: book.note ?? '', rating: String(book.rating ?? ''), start_date: book.start_date ?? '', end_date: book.end_date ?? '' }); }}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">{book.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {book.author && <p className="text-xs text-slate-400">{book.author}</p>}
                    {book.start_date && book.end_date && (
                      <p className="text-[10px] text-slate-300">
                        {book.start_date.slice(5)} ~ {book.end_date.slice(5)}
                      </p>
                    )}
                    {book.start_date && !book.end_date && (
                      <p className="text-[10px] text-slate-300">{book.start_date.slice(5)} ~</p>
                    )}
                  </div>
                  {book.rating != null && <div className="mt-1"><StarDisplay value={book.rating} /></div>}
                  {book.note && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{book.note}</p>}
                </div>
                <select
                  value={book.status}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateBookStatus(book.id, e.target.value as BookStatus)}
                  disabled={mutating.has(`book_status_${book.id}`)}
                  className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${statusConfig[book.status].color}`}
                >
                  <option value="planned">예정</option>
                  <option value="reading">읽는 중</option>
                  <option value="completed">완독</option>
                  <option value="wishlist">읽고 싶음</option>
                </select>
                {deletingBook === book.id ? (
                  <DeleteConfirm onConfirm={() => deleteBook(book.id)} onCancel={() => setDeletingBook(null)} disabled={mutating.has(`book_delete_${book.id}`)} />
                ) : (
                  <button onClick={e => { e.stopPropagation(); setDeletingBook(book.id); }} className="text-slate-300 hover:text-red-400 transition-colors shrink-0 mt-0.5 opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          ))}
          {booksHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreBooks} disabled={booksLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {booksLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 영어 학습 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">영어 학습 기록</p>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('english', exportApi.english)} disabled={exporting.has('english')} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {exporting.has('english') ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
            <button onClick={() => setShowEngForm(!showEngForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
              + 추가
            </button>
          </div>
        </div>
        {/* 월 필터 */}
        {engMonths.length > 1 && (
          <div className="px-5 py-2.5 border-b border-slate-50 flex items-center gap-2 overflow-x-auto">
            {(['all', ...engMonths] as const).map(m => (
              <button key={m} onClick={() => setEngMonthFilter(m)}
                className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors ${engMonthFilter === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {m === 'all' ? '전체' : m}
              </button>
            ))}
          </div>
        )}
        {showEngForm && (
          <form onSubmit={submitEng} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" value={engForm.log_date}
                  onChange={e => setEngForm({ ...engForm, log_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">유형</label>
                <select value={engForm.activity_type}
                  onChange={e => setEngForm({ ...engForm, activity_type: e.target.value })}
                  className={inputCls}>
                  <option value="reading">읽기</option>
                  <option value="listening">듣기</option>
                  <option value="speaking">말하기</option>
                  <option value="writing">쓰기</option>
                  <option value="vocab">단어</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (분)</label>
                <input type="number" min="1" value={engForm.duration_minutes}
                  onChange={e => setEngForm({ ...engForm, duration_minutes: e.target.value })}
                  className={inputCls} required />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500 mb-1 block">메모</label>
                <input type="text" value={engForm.note}
                  onChange={e => setEngForm({ ...engForm, note: e.target.value })}
                  className={inputCls} placeholder="오늘 학습 내용..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowEngForm(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" disabled={mutating.has('eng_create')} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {mutating.has('eng_create') && <Loader2 size={13} className="animate-spin" />}저장
              </button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {englishLogs.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 영어 학습 기록이 없어요</p>
              <button onClick={() => setShowEngForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
            </div>
          ) : filteredEngLogs.map(log => (
            editingEng?.id === log.id ? (
              <div key={log.id} className="px-5 py-3 bg-blue-50 border-l-2 border-blue-400">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <select value={editingEng.activity_type}
                    onChange={e => setEditingEng({ ...editingEng, activity_type: e.target.value })}
                    className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {['reading','listening','speaking','writing','vocab'].map(t => (
                      <option key={t} value={t}>{activityLabels[t] ?? t}</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={editingEng.duration_minutes}
                    onChange={e => setEditingEng({ ...editingEng, duration_minutes: e.target.value })}
                    placeholder="분" className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <input type="text" value={editingEng.note}
                    onChange={e => setEditingEng({ ...editingEng, note: e.target.value })}
                    placeholder="메모" className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEngEdit} disabled={mutating.has('eng_edit')} className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{mutating.has('eng_edit') && <Loader2 size={11} className="animate-spin" />}저장</button>
                  <button onClick={() => setEditingEng(null)} className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700">취소</button>
                </div>
              </div>
            ) : (
              <div key={log.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => { if (deletingEng !== log.id) setEditingEng({ id: log.id, activity_type: log.activity_type, duration_minutes: String(log.duration_minutes), note: log.note ?? '' }); }}>
                <span className="text-slate-400 text-xs w-24 shrink-0">{log.log_date}</span>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                  {activityLabels[log.activity_type] ?? log.activity_type}
                </span>
                <span className="text-sm text-slate-700 shrink-0">{log.duration_minutes}분</span>
                {log.note && <span className="text-slate-400 text-xs hidden sm:block truncate">{log.note}</span>}
                {deletingEng === log.id ? (
                  <DeleteConfirm onConfirm={() => deleteEnglish(log.id)} onCancel={() => setDeletingEng(null)} disabled={mutating.has(`eng_delete_${log.id}`)} />
                ) : (
                  <button onClick={e => { e.stopPropagation(); setDeletingEng(log.id); }} className="ml-auto text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          ))}
          {engHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreEng} disabled={engLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {engLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
