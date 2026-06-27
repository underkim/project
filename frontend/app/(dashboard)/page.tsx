'use client';

import { useEffect, useState, Fragment } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import Link from 'next/link';
import {
  CalendarDays, TrendingUp, Activity, BookOpen,
  Briefcase, AlertTriangle, ChevronRight, Plane,
  Star, MapPin, Dumbbell, FileText, X,
} from 'lucide-react';
import { dashboardApi, aiApi } from '@/lib/api';
import type { OverviewResponse } from '@/types';

// SVG 원형 진행률 링
function RingProgress({ pct, size = 96, stroke = 8, color = '#0f172a' }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
    </svg>
  );
}

// 가는 수평 진행 바
function ProgressBar({ value, max, color = 'bg-slate-900' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// 별점 표시
function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={11} className={i < Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
      ))}
    </div>
  );
}

// 주간 운동 도트 (월~일)
function WeekDots({ days }: { days: number }) {
  return (
    <div className="flex gap-1 mt-1">
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium ${
            i < days ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'
          }`}
        >
          {['월', '화', '수', '목', '금', '토', '일'][i]}
        </div>
      ))}
    </div>
  );
}

interface ModuleCardProps {
  title: string;
  icon: React.ReactNode;
  href: string;
  accent?: string;
  children: React.ReactNode;
}

function ModuleCard({ title, icon, href, accent = 'bg-slate-50', children }: ModuleCardProps) {
  return (
    <Link href={href} className="block group">
      <div className="border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden">
        <div className={`flex items-center justify-between px-5 py-3 ${accent}`}>
          <div className="flex items-center gap-2 text-slate-600">
            {icon}
            <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
          </div>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </Link>
  );
}

// **bold** 구문을 안전한 React 노드로 변환 (HTML 주입 없음)
function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold">{part}</strong>
      : <Fragment key={i}>{part}</Fragment>
  );
}

function ReportMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-slate-700 leading-relaxed">
      {lines.map((line, i) => {
        if (/^### (.+)/.test(line)) {
          return <p key={i} className="font-bold text-slate-900 text-xs uppercase tracking-wider mt-4 first:mt-0">{line.replace(/^### /, '')}</p>;
        }
        if (/^## (.+)/.test(line)) {
          return <p key={i} className="font-bold text-slate-900 text-base mt-4 first:mt-0">{line.replace(/^## /, '')}</p>;
        }
        if (/^# (.+)/.test(line)) {
          return <p key={i} className="font-bold text-slate-900 text-lg mt-4 first:mt-0">{line.replace(/^# /, '')}</p>;
        }
        if (/^[-*] (.+)/.test(line)) {
          const content = line.replace(/^[-*] /, '');
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-slate-300 mt-1 shrink-0">•</span>
              <span>{parseBold(content)}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return (
          <p key={i}>{parseBold(line)}</p>
        );
      })}
    </div>
  );
}

function WeeklyReportModal({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    aiApi.weeklyReport()
      .then(res => setReport(res.report))
      .catch((err: Error) => setError(err.message || '리포트 생성에 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-slate-500" />
            <span className="font-semibold text-slate-800 text-sm">AI 주간 리포트</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Gemini가 분석 중입니다...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <ReportMarkdown text={report} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [assetGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('asset_goal') ?? '0', 10) || 0;
  });

  const [bookGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const year = new Date().getFullYear();
    return parseInt(localStorage.getItem(`book_goal_${year}`) ?? '0', 10) || 0;
  });

  const [engGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const d = new Date();
    return parseInt(localStorage.getItem(`eng_goal_${d.getFullYear()}_${d.getMonth() + 1}`) ?? '0', 10) || 0;
  });

  const [cfGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('cf_rating_goal') ?? '0', 10) || 0;
  });

  function load() {
    dashboardApi.getOverview()
      .then(setData)
      .catch((err: Error) => setError(err.message || '데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useAiRefresh([], load);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-500 py-4">{error}</p>;

  const { planner, finance, health, growth, career, travel } = data ?? {};

  const completionRate = planner && planner.total_items > 0
    ? Math.round((planner.completed_items / planner.total_items) * 100)
    : 0;

  const savingsRate = finance?.avg_savings_rate ?? 0;
  const exerciseDays = health?.exercise_days_this_week ?? 0;
  const sleepQuality = health?.avg_sleep_quality_this_week ?? 0;
  const booksThisYear = growth?.books_completed_this_year ?? 0;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const hasAlert = planner && (planner.urgent_items > 0 || planner.overdue_items > 0);
  const currentPhase = planner?.phases.find(p => p.is_current) ?? null;

  const MODULE_LABELS: Record<string, string> = {
    planner: '플래너', finance: '재테크', health: '건강',
    growth: '자기계발', career: '커리어', travel: '여행',
  };

  return (
    <div className="space-y-6">
      {showReport && <WeeklyReportModal onClose={() => setShowReport(false)} />}

      {/* 부분 실패 안내 */}
      {data?.meta?.partial_failure && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            일부 데이터를 불러오지 못했습니다
            {data.meta.failed_modules.length > 0 && (
              <> ({data.meta.failed_modules.map(m => MODULE_LABELS[m] ?? m).join(', ')})</>
            )}
          </span>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">오늘의 현황</h1>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasAlert && (
            <Link href="/planner">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl hover:bg-amber-100 transition-colors font-medium">
                <AlertTriangle size={12} />
                지연 {planner!.overdue_items} · 임박 {planner!.urgent_items}
              </span>
            </Link>
          )}
          <button
            onClick={() => setShowReport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-xl hover:bg-slate-700 transition-colors font-medium"
          >
            <FileText size={12} />
            주간 리포트
          </button>
        </div>
      </div>

      {/* 히어로: 로드맵 링 + 핵심 지표 */}
      <div className="bg-slate-900 text-white rounded-2xl px-6 py-6 flex items-center gap-6">
        {/* 링 */}
        <Link href="/planner" className="relative shrink-0">
          <RingProgress pct={completionRate} size={96} stroke={8} color={currentPhase ? currentPhase.color : '#94a3b8'} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold leading-none">{completionRate}%</span>
            <span className="text-[9px] text-slate-400 mt-0.5">
              {currentPhase ? currentPhase.name : '로드맵'}
            </span>
          </div>
        </Link>

        {/* 핵심 지표 */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
          {[
            {
              href: '/finance',
              label: '총 자산',
              value: finance?.latest_total_assets != null ? `${finance.latest_total_assets.toLocaleString()}만` : '—',
              sub: savingsRate > 0 ? `저축률 ${savingsRate}%` : '미입력',
            },
            {
              href: '/health',
              label: '이번 주 운동',
              value: `${exerciseDays}일`,
              sub: (health?.total_exercise_minutes_this_week ?? 0) > 0
                ? `${health!.total_exercise_minutes_this_week}분 · 수면 ${health?.avg_sleep_hours_this_week ?? '—'}h`
                : sleepQuality > 0 ? `수면 ${sleepQuality}/5` : '수면 미입력',
            },
            {
              href: '/growth',
              label: '올해 완독',
              value: `${booksThisYear}권`,
              sub: (() => {
                const days = growth?.english_days_this_month ?? 0;
                const mins = growth?.english_minutes_this_month ?? 0;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
                return days > 0 ? `영어 ${days}일 · ${timeStr}` : '영어 기록 없음';
              })(),
            },
            {
              href: '/travel',
              label: '여행',
              value: travel?.ongoing && travel.ongoing > 0 ? '진행 중' : `예정 ${travel?.upcoming ?? 0}개`,
              sub: travel?.next_trip_name ?? '없음',
            },
          ].map(item => (
            <Link key={item.href} href={item.href} className="block hover:opacity-80 transition-opacity">
              <p className="text-lg font-bold leading-none">{item.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{item.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.sub}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* 현재 Phase 진행 상황 */}
      {currentPhase && (
        <Link href="/planner" className="block">
          <div className="border border-slate-100 rounded-2xl px-5 py-3.5 hover:border-slate-200 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: currentPhase.color }} />
                <span className="text-sm font-semibold text-slate-800">{currentPhase.name}</span>
                <span className="text-xs text-emerald-500 font-medium bg-emerald-50 px-1.5 py-0.5 rounded-full">현재 단계</span>
              </div>
              <span className="text-xs text-slate-400">
                {currentPhase.completed}/{currentPhase.total}개 완료
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${currentPhase.total > 0 ? Math.round((currentPhase.completed / currentPhase.total) * 100) : 0}%`,
                  backgroundColor: currentPhase.color,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {currentPhase.label} · {currentPhase.total > 0 ? Math.round((currentPhase.completed / currentPhase.total) * 100) : 0}% 달성
            </p>
          </div>
        </Link>
      )}

      {/* 모듈 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* 플래너 */}
        <ModuleCard title="플래너" icon={<CalendarDays size={14} />} href="/planner" accent="bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
              <p className="text-xs text-slate-400 mt-0.5">전체 {planner?.total_items ?? 0}개 중 {planner?.completed_items ?? 0}개 완료</p>
            </div>
            <RingProgress pct={completionRate} size={52} stroke={5} color="#0f172a" />
          </div>
          <ProgressBar value={planner?.completed_items ?? 0} max={planner?.total_items ?? 1} />
          {planner?.phases && planner.phases.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {planner.phases.map(p => {
                const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className={`text-[10px] w-16 shrink-0 truncate ${p.is_current ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                      {p.label || p.name}
                    </span>
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: p.color || '#0f172a' }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-6 text-right shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-4 mt-3">
            {planner?.urgent_items != null && planner.urgent_items > 0 && (
              <span className="text-xs text-amber-600 font-medium">⚡ 임박 {planner.urgent_items}개</span>
            )}
            {planner?.overdue_items != null && planner.overdue_items > 0 && (
              <span className="text-xs text-red-500 font-medium">⚠️ 지연 {planner.overdue_items}개</span>
            )}
            {(!planner?.urgent_items && !planner?.overdue_items) && (
              <span className="text-xs text-slate-400">일정 순조로움</span>
            )}
          </div>
        </ModuleCard>

        {/* 건강 */}
        <ModuleCard title="건강" icon={<Activity size={14} />} href="/health" accent="bg-emerald-50">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Dumbbell size={11} /> 이번 주 운동</span>
                <span className="text-sm font-bold text-slate-900">{exerciseDays} / 7일</span>
              </div>
              <WeekDots days={exerciseDays} />
              <div className="flex items-center gap-3 mt-1.5">
                {(health?.total_exercise_minutes_this_week ?? 0) > 0 && (
                  <p className="text-[11px] text-slate-400">총 {health?.total_exercise_minutes_this_week}분</p>
                )}
                {(health?.exercise_streak ?? 0) >= 2 && (
                  <p className="text-[11px] text-orange-500 font-medium">🔥 {health!.exercise_streak}일 연속</p>
                )}
              </div>
            </div>
            {health?.avg_sleep_hours_this_week && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">평균 수면</span>
                <span className="text-xs font-medium text-slate-700">{health.avg_sleep_hours_this_week}시간</span>
              </div>
            )}
            {sleepQuality > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">수면 품질</span>
                <div className="flex items-center gap-1.5">
                  <Stars value={sleepQuality} />
                  <span className={`text-[10px] font-medium ${sleepQuality >= 4 ? 'text-emerald-600' : sleepQuality <= 2 ? 'text-red-400' : 'text-slate-400'}`}>
                    {['', '최악', '나쁨', '보통', '좋음', '최고'][Math.round(sleepQuality)]}
                  </span>
                </div>
              </div>
            )}
          </div>
        </ModuleCard>

        {/* 재테크 */}
        <ModuleCard title="재테크" icon={<TrendingUp size={14} />} href="/finance" accent="bg-blue-50">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">총 자산</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-slate-900">
                  {finance?.latest_total_assets != null
                    ? `${finance.latest_total_assets.toLocaleString()}만원`
                    : <span className="text-slate-300 text-base">미입력</span>}
                </p>
                {finance?.asset_change != null && finance.asset_change !== 0 && (
                  <span className={`text-xs font-semibold mb-0.5 ${finance.asset_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {finance.asset_change > 0 ? '+' : ''}{finance.asset_change.toLocaleString()}만
                  </span>
                )}
              </div>
            </div>
            {assetGoal > 0 && finance?.latest_total_assets != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>목표 달성률</span>
                  <span className="font-medium text-slate-700">
                    {Math.min(100, Math.round((finance.latest_total_assets / assetGoal) * 100))}%
                  </span>
                </div>
                <ProgressBar
                  value={finance.latest_total_assets}
                  max={assetGoal}
                  color="bg-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">목표 {assetGoal.toLocaleString()}만원</p>
              </div>
            )}
            {savingsRate > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>저축률</span>
                  <span className="font-medium text-slate-700">{savingsRate}%</span>
                </div>
                <ProgressBar
                  value={savingsRate}
                  max={100}
                  color={savingsRate >= 30 ? 'bg-emerald-500' : savingsRate >= 15 ? 'bg-amber-400' : 'bg-red-400'}
                />
              </div>
            )}
          </div>
        </ModuleCard>

        {/* 자기계발 */}
        <ModuleCard title="자기계발" icon={<BookOpen size={14} />} href="/growth" accent="bg-violet-50">
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-slate-900">{booksThisYear}</p>
              <p className="text-sm text-slate-400 mb-1">권 (올해 완독)</p>
            </div>
            {bookGoal > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>독서 목표</span>
                  <span className="font-medium text-slate-600">{booksThisYear} / {bookGoal}권</span>
                </div>
                <ProgressBar value={booksThisYear} max={bookGoal} color="bg-violet-500" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">읽는 중</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{growth?.books_reading ?? 0}권</span>
                {(growth?.books_wishlist ?? 0) > 0 && (
                  <span className="text-[10px] text-violet-400">찜 {growth!.books_wishlist}권</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">이번 달 영어</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-700">{growth?.english_days_this_month ?? 0}일</span>
                {engGoal > 0
                  ? <span className="text-[10px] text-slate-300">/ {engGoal}일</span>
                  : <span className="text-[10px] text-slate-300">/ 30일</span>
                }
              </div>
            </div>
            <ProgressBar
              value={growth?.english_days_this_month ?? 0}
              max={engGoal > 0 ? engGoal : 30}
              color={engGoal > 0 && (growth?.english_days_this_month ?? 0) >= engGoal ? 'bg-emerald-500' : 'bg-violet-500'}
            />
            <div className="flex items-center gap-3">
              {(growth?.english_minutes_this_month ?? 0) > 0 && (() => {
                const mins = growth!.english_minutes_this_month;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return (
                  <p className="text-[11px] text-slate-400">
                    누적 {h > 0 ? `${h}시간 ` : ''}{m > 0 || h === 0 ? `${m}분` : ''}
                  </p>
                );
              })()}
              {(growth?.english_streak ?? 0) >= 2 && (
                <p className="text-[11px] text-violet-500 font-medium">🔥 {growth!.english_streak}일 연속</p>
              )}
            </div>
          </div>
        </ModuleCard>

        {/* 여행 */}
        <ModuleCard title="여행" icon={<Plane size={14} />} href="/travel" accent="bg-sky-50">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-slate-900">{travel?.total ?? 0}</p>
              <div className="text-xs text-slate-400 space-y-0.5">
                {(travel?.ongoing ?? 0) > 0 && (
                  <p className="text-sky-600 font-medium">진행 중 {travel!.ongoing}개</p>
                )}
                <p>예정 {travel?.upcoming ?? 0}개</p>
                <p>완료 {(travel?.total ?? 0) - (travel?.upcoming ?? 0) - (travel?.ongoing ?? 0)}개</p>
              </div>
            </div>
            {travel?.next_trip_name && (
              <div className="mt-1 px-3 py-2 bg-sky-50 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-sky-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 truncate">{travel.next_trip_name}</p>
                    {travel.next_trip_destination && (
                      <p className="text-[10px] text-slate-400 truncate">{travel.next_trip_destination}</p>
                    )}
                  </div>
                  {travel.next_trip_start_date && (() => {
                    const todayMs = new Date().setHours(0, 0, 0, 0);
                    const depMs = new Date(travel.next_trip_start_date!).setHours(0, 0, 0, 0);
                    const diff = Math.round((depMs - todayMs) / 86400000);
                    const label = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : '여행 중';
                    const cls = diff === 0 ? 'text-red-500' : diff <= 7 ? 'text-amber-500' : 'text-sky-500';
                    return <span className={`text-[11px] font-bold shrink-0 ${cls}`}>{label}</span>;
                  })()}
                </div>
                {(travel.next_trip_plan_total ?? 0) > 0 && (
                  <p className="text-[10px] text-slate-400">
                    일정 <span className="font-medium text-slate-600">{travel.next_trip_plan_total}개</span> 등록됨
                  </p>
                )}
                {(travel.next_trip_checklist_total ?? 0) > 0 && (
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>체크리스트</span>
                      <span>{travel.next_trip_checklist_done} / {travel.next_trip_checklist_total}</span>
                    </div>
                    <ProgressBar
                      value={travel.next_trip_checklist_done}
                      max={travel.next_trip_checklist_total}
                      color={travel.next_trip_checklist_done === travel.next_trip_checklist_total ? 'bg-emerald-500' : 'bg-sky-400'}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </ModuleCard>

        {/* 커리어 */}
        <ModuleCard title="커리어" icon={<Briefcase size={14} />} href="/career" accent="bg-orange-50">
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-400 mb-1">Codeforces</p>
              <p className="text-lg font-bold text-slate-900">{career?.cf_handle ?? <span className="text-slate-300 text-sm">미설정</span>}</p>
            </div>
            {career?.latest_cf_rating != null && (
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-xl">
                <span className="text-xs text-slate-500">최근 레이팅</span>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm font-bold text-slate-900">{career.latest_cf_rating}</span>
                    {career.rating_delta != null && career.rating_delta !== 0 && (
                      <span className={`text-[10px] font-semibold ${career.rating_delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {career.rating_delta > 0 ? '+' : ''}{career.rating_delta}
                      </span>
                    )}
                  </div>
                  {career.latest_cf_rank && (
                    <p className="text-[10px] text-slate-400">{career.latest_cf_rank}</p>
                  )}
                </div>
              </div>
            )}
            {cfGoal > 0 && career?.latest_cf_rating != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>목표 레이팅</span>
                  <span className="font-medium text-slate-600">
                    {career.latest_cf_rating} / {cfGoal}
                    {career.latest_cf_rating >= cfGoal && ' 🎉'}
                  </span>
                </div>
                <ProgressBar
                  value={career.latest_cf_rating}
                  max={cfGoal}
                  color={career.latest_cf_rating >= cfGoal ? 'bg-emerald-500' : 'bg-orange-400'}
                />
              </div>
            )}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}
