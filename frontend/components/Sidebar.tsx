'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  Activity,
  ListChecks,
  Plane,
  LogOut,
  Map,
  ChevronLeft,
  HelpCircle,
} from 'lucide-react';

const navGroups = [
  { label: '오늘', items: [{ href: '/', icon: LayoutDashboard, label: '대시보드' }] },
  { label: '계획', items: [{ href: '/planner', icon: CalendarDays, label: '플래너' }] },
  { label: '기록', items: [{ href: '/trackers', icon: ListChecks, label: '나의 기록' }] },
  { label: '생활 관리', items: [
    { href: '/finance', icon: TrendingUp, label: '재테크' },
    { href: '/health', icon: Activity, label: '건강' },
    { href: '/travel', icon: Plane, label: '여행' },
  ] },
  { label: '도움말', items: [{ href: '/help', icon: HelpCircle, label: '가이드' }] },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('ai-chat-history');
    router.replace('/login?reason=logout');
  }

  return (
    <aside className="h-screen w-56 bg-white border-r border-slate-100 flex flex-col">
      {/* 로고 */}
      <div className="px-5 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
              <Map size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900 tracking-tight">
              Life Dashboard
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="메뉴 닫기"
              className="md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 내비게이션 */}
      <nav className="flex-1 px-3 pb-3 space-y-4 overflow-y-auto" aria-label="주요 기능">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">{group.label}</p>
            <div className="space-y-0.5">{group.items.map(({ href, icon: Icon, label }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return <Link key={href} href={href} onClick={onClose} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-slate-50 text-slate-900 font-medium' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}><Icon size={15} className={active ? 'text-slate-700' : 'text-slate-400'} />{label}</Link>;
            })}</div>
          </div>
        ))}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors w-full"
        >
          <LogOut size={15} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
