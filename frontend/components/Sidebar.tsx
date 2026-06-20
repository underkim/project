'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, TrendingUp,
  Activity, BookOpen, Briefcase, Plane, LogOut, Map,
  Send, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { aiApi } from '@/lib/api';

const navItems = [
  { href: '/',        icon: LayoutDashboard, label: '대시보드' },
  { href: '/planner', icon: CalendarDays,    label: '플래너'   },
  { href: '/finance', icon: TrendingUp,      label: '재테크'   },
  { href: '/health',  icon: Activity,        label: '건강'     },
  { href: '/growth',  icon: BookOpen,        label: '자기계발' },
  { href: '/career',  icon: Briefcase,       label: '커리어'   },
  { href: '/travel',  icon: Plane,           label: '여행'     },
];

const MODULE_LABEL: Record<string, string> = {
  health_exercise: '운동',
  health_sleep: '수면',
  finance_record: '재테크',
  growth_book: '독서',
  growth_english: '영어',
  career_cf_rating: 'CF 레이팅',
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; module?: string | null; action?: string | null } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function logout() {
    localStorage.removeItem('token');
    router.replace('/login');
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setLoading(true);
    setFeedback(null);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);

    try {
      const res = await aiApi.chat(msg);
      setFeedback({ ok: res.saved, text: res.message, module: res.module, action: res.action });
    } catch {
      setFeedback({ ok: false, text: '요청에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setLoading(false);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-slate-100 flex flex-col z-10">
      {/* 로고 */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
            <Map size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 tracking-tight">Life Dashboard</span>
        </div>
      </div>

      {/* 내비게이션 */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-slate-50 text-slate-900 font-medium'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} className={active ? 'text-slate-700' : 'text-slate-400'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* AI 입력창 */}
      <div className="px-3 py-3 border-t border-slate-100">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">AI 기록</p>

        {/* 피드백 */}
        {feedback && (
          <div className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 mb-2 text-xs leading-snug ${
            feedback.ok ? 'bg-slate-50 text-slate-700' : 'bg-red-50 text-red-600'
          }`}>
            {feedback.ok
              ? <CheckCircle2 size={12} className="text-slate-500 shrink-0 mt-0.5" />
              : <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />}
            <div>
              {feedback.module && feedback.ok && (
                <span className="font-medium text-slate-500">
                  [{MODULE_LABEL[feedback.module] ?? feedback.module}
                  {feedback.action === 'delete' ? ' 삭제' : ' 추가'}]&nbsp;
                </span>
              )}
              {feedback.text}
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={"오늘 러닝 30분 했어\n어제 7시간 잤어"}
            rows={2}
            disabled={loading}
            className="w-full resize-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 bottom-2 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-300 mt-1.5 px-1">Enter로 전송 · Shift+Enter 줄바꿈</p>
      </div>

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
