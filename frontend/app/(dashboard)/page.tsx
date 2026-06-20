'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays, TrendingUp, Activity, BookOpen,
  Briefcase, AlertTriangle, ChevronRight, Plane,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import type { OverviewResponse } from '@/types';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>{value} / {max}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface CardProps {
  title: string;
  icon: React.ReactNode;
  href: string;
  children: React.ReactNode;
}

function Card({ title, icon, href, children }: CardProps) {
  return (
    <Link href={href} className="block group">
      <div className="border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <div className="flex items-center gap-2 text-slate-500">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
          </div>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
        </div>
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.getOverview()
      .then(setData)
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>;
  }

  const { planner, finance, health, growth, career, travel } = data ?? {};
  const completionRate = planner && planner.total_items > 0
    ? Math.round((planner.completed_items / planner.total_items) * 100)
    : 0;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">대시보드</h1>
        <p className="text-sm text-slate-400 mt-0.5">{today}</p>
      </div>

      {/* 경고 */}
      {planner && (planner.urgent_items > 0 || planner.overdue_items > 0) && (
        <Link href="/planner">
          <div className="flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 hover:bg-amber-100 transition-colors">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              주의 필요한 항목 — 지연 {planner.overdue_items}개 · 임박 {planner.urgent_items}개
            </p>
          </div>
        </Link>
      )}

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: '로드맵 진행률',
            value: `${completionRate}%`,
            sub: `${planner?.completed_items ?? 0}/${planner?.total_items ?? 0}`,
            href: '/planner',
          },
          {
            label: '총 자산',
            value: finance?.latest_total_assets != null ? `${finance.latest_total_assets.toLocaleString()}만` : '—',
            sub: finance?.avg_savings_rate != null ? `저축률 ${finance.avg_savings_rate}%` : '',
            href: '/finance',
          },
          {
            label: '이번 주 운동',
            value: `${health?.exercise_days_this_week ?? 0}일`,
            sub: health?.avg_sleep_quality_this_week != null ? `수면 ${health.avg_sleep_quality_this_week}/5` : '',
            href: '/health',
          },
          {
            label: '올해 완독',
            value: `${growth?.books_completed_this_year ?? 0}권`,
            sub: `영어 ${growth?.english_days_this_month ?? 0}일/월`,
            href: '/growth',
          },
        ].map(item => (
          <Link key={item.href} href={item.href} className="block group">
            <div className="border border-slate-100 rounded-xl px-4 py-4 hover:border-slate-200 transition-colors">
              <p className="text-2xl font-semibold text-slate-900 leading-none">{item.value}</p>
              <p className="text-xs text-slate-400 mt-2">{item.label}</p>
              {item.sub && <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>}
            </div>
          </Link>
        ))}
      </div>

      {/* 스냅샷 그리드 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="플래너" icon={<CalendarDays size={14} />} href="/planner">
          <Stat label="완료" value={`${planner?.completed_items ?? 0}개`} />
          <Stat label="임박 (30일)" value={`${planner?.urgent_items ?? 0}개`} />
          <Stat label="지연" value={`${planner?.overdue_items ?? 0}개`} />
          {planner && <Bar value={planner.completed_items} max={planner.total_items} />}
        </Card>

        <Card title="커리어" icon={<Briefcase size={14} />} href="/career">
          <Stat label="CF 핸들" value={career?.cf_handle ?? '미설정'} />
          <Stat label="최근 레이팅" value={career?.latest_cf_rating ?? '미입력'} />
        </Card>

        <Card title="재테크" icon={<TrendingUp size={14} />} href="/finance">
          <Stat
            label="총 자산"
            value={finance?.latest_total_assets != null ? `${finance.latest_total_assets.toLocaleString()}만원` : '미입력'}
          />
          <Stat
            label="평균 저축률"
            value={finance?.avg_savings_rate != null ? `${finance.avg_savings_rate}%` : '미입력'}
          />
          {finance?.avg_savings_rate != null && (
            <Bar value={finance.avg_savings_rate} max={100} />
          )}
        </Card>

        <Card title="자기계발" icon={<BookOpen size={14} />} href="/growth">
          <Stat label="올해 완독" value={`${growth?.books_completed_this_year ?? 0}권`} />
          <Stat label="이번 달 영어" value={`${growth?.english_days_this_month ?? 0}일`} />
        </Card>

        <Card title="여행" icon={<Plane size={14} />} href="/travel">
          <Stat label="총 여행" value={`${travel?.total ?? 0}개`} />
          <Stat label="예정" value={`${travel?.upcoming ?? 0}개`} />
          {travel?.next_trip_name && (
            <p className="text-sm font-medium text-slate-900 mt-3 truncate">{travel.next_trip_name}</p>
          )}
        </Card>

        <Card title="건강" icon={<Activity size={14} />} href="/health">
          <Stat label="이번 주 운동" value={`${health?.exercise_days_this_week ?? 0}일`} />
          <Stat
            label="수면 품질"
            value={health?.avg_sleep_quality_this_week != null ? `${health.avg_sleep_quality_this_week}/5` : '—'}
          />
        </Card>
      </div>
    </div>
  );
}
