'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import Link from 'next/link';
import {
  CalendarDays, TrendingUp, Activity, BookOpen,
  Briefcase, AlertTriangle, ChevronRight, Plane,
  Star, MapPin, Dumbbell,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
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

export default function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    dashboardApi.getOverview()
      .then(setData)
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">오늘의 현황</h1>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
        {hasAlert && (
          <Link href="/planner">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl hover:bg-amber-100 transition-colors font-medium">
              <AlertTriangle size={12} />
              지연 {planner!.overdue_items} · 임박 {planner!.urgent_items}
            </span>
          </Link>
        )}
      </div>

      {/* 히어로: 로드맵 링 + 핵심 지표 */}
      <div className="bg-slate-900 text-white rounded-2xl px-6 py-6 flex items-center gap-6">
        {/* 링 */}
        <Link href="/planner" className="relative shrink-0">
          <RingProgress pct={completionRate} size={96} stroke={8} color="#94a3b8" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold leading-none">{completionRate}%</span>
            <span className="text-[9px] text-slate-400 mt-0.5">로드맵</span>
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
              sub: sleepQuality > 0 ? `수면 ${sleepQuality}/5` : '수면 미입력',
            },
            {
              href: '/growth',
              label: '올해 완독',
              value: `${booksThisYear}권`,
              sub: `영어 ${growth?.english_days_this_month ?? 0}일/월`,
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
            </div>
            {sleepQuality > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">평균 수면 품질</span>
                <Stars value={sleepQuality} />
              </div>
            )}
          </div>
        </ModuleCard>

        {/* 재테크 */}
        <ModuleCard title="재테크" icon={<TrendingUp size={14} />} href="/finance" accent="bg-blue-50">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">총 자산</p>
              <p className="text-2xl font-bold text-slate-900">
                {finance?.latest_total_assets != null
                  ? `${finance.latest_total_assets.toLocaleString()}만원`
                  : <span className="text-slate-300 text-base">미입력</span>}
              </p>
            </div>
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
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">읽는 중</span>
              <span className="text-xs font-medium text-slate-700">{growth?.books_reading ?? 0}권</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">이번 달 영어</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-700">{growth?.english_days_this_month ?? 0}일</span>
                <span className="text-[10px] text-slate-300">/ 30일</span>
              </div>
            </div>
            <ProgressBar value={growth?.english_days_this_month ?? 0} max={30} color="bg-violet-500" />
          </div>
        </ModuleCard>

        {/* 여행 */}
        <ModuleCard title="여행" icon={<Plane size={14} />} href="/travel" accent="bg-sky-50">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-slate-900">{travel?.total ?? 0}</p>
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>진행 중 {travel?.ongoing ?? 0}개</p>
                <p>예정 {travel?.upcoming ?? 0}개</p>
              </div>
            </div>
            {travel?.next_trip_name && (
              <div className="flex items-center gap-1.5 mt-1 px-3 py-2 bg-sky-50 rounded-xl">
                <MapPin size={12} className="text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{travel.next_trip_name}</p>
                  {travel.next_trip_destination && (
                    <p className="text-[10px] text-slate-400 truncate">{travel.next_trip_destination}</p>
                  )}
                </div>
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
                <span className="text-sm font-bold text-slate-900">{career.latest_cf_rating}</span>
              </div>
            )}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
}
