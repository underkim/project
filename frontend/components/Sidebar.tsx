'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, TrendingUp,
  Activity, BookOpen, Briefcase, Plane, LogOut, Map,
  Send, Loader2, X, CheckCircle2, Trash2, ChevronLeft,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import type { AiChatResponse } from '@/lib/api';

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
  travel_trip: '여행',
  travel_checklist: '여행 체크리스트',
  planner_item: '플래너',
};

type Message = {
  id: number;
  role: 'user' | 'ai';
  text: string;
  saved?: boolean;
  module?: string | null;
  action?: string | null;
  pendingFilter?: Record<string, unknown> | null;
  confirmLoading?: boolean;
  timestamp?: string;
};

let msgId = 0;

export function dispatchAiSaved(module: string | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-data-saved', { detail: { module } }));
  }
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('ai-chat-history');
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [chatOpen, setChatOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('ai-chat-history');
      const msgs = saved ? (JSON.parse(saved) as Message[]) : [];
      return msgs.length > 0;
    } catch {
      return false;
    }
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  // messages 변경 시 localStorage에 저장 (최근 30개만)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const toSave = messages.slice(-30).map(m => ({
      ...m,
      confirmLoading: false,
      pendingFilter: null,
    }));
    localStorage.setItem('ai-chat-history', JSON.stringify(toSave));
  }, [messages]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('ai-chat-history');
    router.replace('/login');
  }

  function getHistory() {
    return messages.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.text }));
  }

  function applyAiResponse(res: AiChatResponse) {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const aiMsg: Message = {
      id: ++msgId,
      role: 'ai',
      text: res.reply,
      saved: res.saved,
      module: res.module,
      action: res.action,
      pendingFilter: res.action === 'delete_pending' ? (res.pending_filter ?? null) : null,
      timestamp: now,
    };
    setMessages(prev => [...prev, aiMsg]);

    if (res.saved && res.module) {
      dispatchAiSaved(res.module);
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setChatOpen(true);

    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: ++msgId, role: 'user', text, timestamp: now };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await aiApi.chat(text, getHistory());
      applyAiResponse(res);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const errText = status === 429
        ? 'API 할당량 초과예요. Google AI Studio에서 키를 재발급해주세요.'
        : detail ?? '요청에 실패했어요. 잠시 후 다시 시도해주세요.';
      setMessages(prev => [...prev, { id: ++msgId, role: 'ai', text: errText }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete(msgLocalId: number, module: string, filter: Record<string, unknown>) {
    setMessages(prev =>
      prev.map(m => m.id === msgLocalId ? { ...m, confirmLoading: true } : m)
    );
    try {
      const res = await aiApi.execute(module, filter);
      setMessages(prev => prev.map(m =>
        m.id === msgLocalId
          ? { ...m, confirmLoading: false, action: 'delete', saved: res.saved, pendingFilter: null }
          : m
      ));
      if (res.saved) dispatchAiSaved(module);
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === msgLocalId ? { ...m, confirmLoading: false, pendingFilter: null } : m
      ));
    }
  }

  function handleCancelDelete(msgLocalId: number) {
    setMessages(prev =>
      prev.map(m => m.id === msgLocalId ? { ...m, action: null, pendingFilter: null } : m)
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    setMessages([]);
    setChatOpen(false);
    localStorage.removeItem('ai-chat-history');
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
            <span className="text-sm font-semibold text-slate-900 tracking-tight">Life Dashboard</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          )}
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
              onClick={onClose}
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

      {/* AI 어시스턴트 */}
      <div className="border-t border-slate-100 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">AI 어시스턴트</p>
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-slate-300 hover:text-slate-500 transition-colors">
              <X size={11} />
            </button>
          )}
        </div>

        {/* 채팅 메시지 영역 */}
        {chatOpen && messages.length > 0 && (
          <div className="px-3 max-h-56 overflow-y-auto flex flex-col gap-2 pb-2">
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-700 border border-slate-100'
                }`}>
                  {m.text}
                </div>

                {/* 타임스탬프 */}
                {m.timestamp && (
                  <span className="mt-0.5 text-[9px] text-slate-300 px-1">{m.timestamp}</span>
                )}

                {/* 저장 완료 배지 */}
                {m.role === 'ai' && m.saved && m.module && (
                  <span className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                    <CheckCircle2 size={10} />
                    {MODULE_LABEL[m.module] ?? m.module}
                    {m.action === 'delete' ? ' 삭제됨' : m.action === 'update' ? ' 수정됨' : ' 저장됨'}
                  </span>
                )}

                {/* 삭제 확인 버튼 */}
                {m.role === 'ai' && m.action === 'delete_pending' && m.pendingFilter && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      onClick={() => handleConfirmDelete(m.id, m.module!, m.pendingFilter!)}
                      disabled={m.confirmLoading}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white text-[10px] rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {m.confirmLoading
                        ? <Loader2 size={9} className="animate-spin" />
                        : <Trash2 size={9} />}
                      삭제
                    </button>
                    <button
                      onClick={() => handleCancelDelete(m.id)}
                      disabled={m.confirmLoading}
                      className="px-2.5 py-1 text-slate-400 text-[10px] rounded-lg hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  <Loader2 size={12} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* 입력창 */}
        <div className="px-3 pb-3">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"오늘 러닝 30분 했어\n운동 뭐가 좋을까?"}
              rows={2}
              disabled={loading}
              className="w-full resize-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-2 bottom-2 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-1.5 px-1">Enter 전송 · Shift+Enter 줄바꿈</p>
        </div>
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
