'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot, Send, Loader2, X, CheckCircle2, Trash2, Eraser, ChevronDown, Copy, Check,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import type { AiChatResponse } from '@/lib/api';

type Message = {
  id: number;
  role: 'user' | 'ai';
  text: string;
  saved?: boolean;
  savedCount?: number;
  module?: string | null;
  modules?: string[] | null;
  action?: string | null;
  pendingFilter?: Record<string, unknown> | null;
  confirmLoading?: boolean;
  timestamp?: string;
  dateLabel?: string;
  suggestions?: string[] | null;
};

// ── 복사 버튼 ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-300 hover:text-slate-500"
      title="복사"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// ── 마크다운 렌더링 ────────────────────────────────────────────

function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-slate-800">{part}</strong>
          : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const isBullet = /^[-•] /.test(line);
        const isHeading = /^#{1,3} /.test(line);
        const content = isBullet
          ? line.replace(/^[-•] /, '')
          : isHeading
          ? line.replace(/^#{1,3} /, '')
          : line;
        return (
          <Fragment key={i}>
            {i > 0 && <br />}
            {isBullet && <span className="mr-1 select-none text-slate-400">•</span>}
            {isHeading
              ? <strong className="font-semibold text-slate-800">{parseBold(content)}</strong>
              : parseBold(content)
            }
          </Fragment>
        );
      })}
    </>
  );
}

const MODULE_LABEL: Record<string, string> = {
  health_exercise: '운동',
  health_sleep: '수면',
  finance_record: '재테크',
  growth_book: '독서',
  growth_english: '영어',
  career_cf_rating: 'CF 레이팅',
  travel_trip: '여행',
  travel_checklist: '여행 체크리스트',
  travel_plan: '여행 일정',
  planner_item: '플래너 항목',
  planner_category: '플래너 카테고리',
};

let msgId = Date.now();

export function dispatchAiSaved(module: string | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-data-saved', { detail: { module } }));
  }
}

export default function AiModal() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('ai-chat-history');
      const msgs = saved ? (JSON.parse(saved) as Message[]) : [];
      if (msgs.length > 0) msgId = Math.max(msgId, ...msgs.map(m => m.id));
      return msgs;
    } catch { return []; }
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    if (messages.length === 0 || open) inputRef.current?.focus();
    return () => cancelAnimationFrame(id);
  }, [open, messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const toSave = messages.slice(-40).map(m => ({
      ...m,
      confirmLoading: false,
    }));
    localStorage.setItem('ai-chat-history', JSON.stringify(toSave));
  }, [messages]);

  function getHistory() {
    return messages.slice(-20).map(m => {
      let text = m.text;
      // 저장 완료된 AI 메시지는 모듈 힌트 추가 → 다음 턴에서 AI가 "방금 뭘 저장했는지" 참조 가능
      if (m.role === 'ai' && m.saved && m.module) {
        text = `${text} [저장: ${m.module}]`;
      }
      return { role: m.role === 'user' ? 'user' : 'ai', text };
    });
  }

  function makeTimestamp() {
    const d = new Date();
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const today = new Date(); today.setHours(0,0,0,0);
    const msgDay = new Date(d); msgDay.setHours(0,0,0,0);
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
    const dateLabel = diffDays === 0 ? '' : diffDays === 1 ? '어제 ' : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ';
    return { time, dateLabel };
  }

  function applyAiResponse(res: AiChatResponse) {
    const { time, dateLabel } = makeTimestamp();
    const aiMsg: Message = {
      id: ++msgId,
      role: 'ai',
      text: res.reply,
      saved: res.saved,
      savedCount: res.saved_count,
      module: res.module,
      modules: res.modules,
      action: res.action,
      pendingFilter: res.action === 'delete_pending' ? (res.pending_filter ?? null) : null,
      timestamp: time,
      dateLabel,
      suggestions: res.suggestions ?? null,
    };
    setMessages(prev => [...prev, aiMsg]);
    if (res.saved) {
      const mods = res.modules ?? (res.module ? [res.module] : []);
      mods.forEach(m => dispatchAiSaved(m));
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const { time, dateLabel } = makeTimestamp();
    setMessages(prev => [...prev, { id: ++msgId, role: 'user', text, timestamp: time, dateLabel }]);
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

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await sendMessage(text);
  }

  async function handleConfirmDelete(msgLocalId: number, module: string, filter: Record<string, unknown>) {
    setMessages(prev => prev.map(m => m.id === msgLocalId ? { ...m, confirmLoading: true } : m));
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
        m.id === msgLocalId
          ? { ...m, confirmLoading: false, pendingFilter: null, text: m.text + '\n\n⚠️ 삭제 중 오류가 발생했습니다.' }
          : m
      ));
    }
  }

  function handleCancelDelete(msgLocalId: number) {
    setMessages(prev => prev.map(m =>
      m.id === msgLocalId ? { ...m, action: null, pendingFilter: null } : m
    ));
  }

  function clearChat() {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return; }
    setMessages([]);
    localStorage.removeItem('ai-chat-history');
    setClearConfirm(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <>
      {/* 모달 패널 */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[420px] max-h-[70vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">AI 어시스턴트</p>
                <p className="text-[10px] text-slate-400">기록·수정·삭제·분석·조언 — 자유롭게 대화해요</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                    clearConfirm
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title={clearConfirm ? '한 번 더 클릭하면 초기화됩니다' : '대화 초기화'}
                >
                  <Eraser size={12} />
                  {clearConfirm && <span>확인?</span>}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <Bot size={22} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">무엇을 도와드릴까요?</p>
                  <p className="text-xs text-slate-400 mt-1">기록·조회·분석·조언 뭐든지 말해봐요</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {[
                    { text: '이번 주 어땠어?', icon: '📊' },
                    { text: '오늘 러닝 40분', icon: '🏃' },
                    { text: '다음 우선순위 뭐야?', icon: '🎯' },
                    { text: '요즘 생활 분석해줘', icon: '💡' },
                    { text: '파친코 완독했어', icon: '📚' },
                    { text: '어젯밤 수면 7시간 품질 4점', icon: '😴' },
                  ].map(({ text, icon }) => (
                    <button
                      key={text}
                      onClick={() => sendMessage(text)}
                      className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-colors flex items-center gap-1"
                    >
                      <span>{icon}</span>
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-sm whitespace-pre-wrap'
                    : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-sm'
                }`}>
                  {m.role === 'ai' ? <MarkdownText text={m.text} /> : m.text}
                  {m.role === 'ai' && (
                    <span className="absolute -top-1 -right-1">
                      <CopyButton text={m.text} />
                    </span>
                  )}
                </div>

                {m.timestamp && (
                  <span className="mt-0.5 text-[10px] text-slate-300 px-1">{m.dateLabel}{m.timestamp}</span>
                )}

                {m.role === 'ai' && m.saved && (
                  <span className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                    <CheckCircle2 size={11} />
                    {m.savedCount && m.savedCount > 1
                      ? `${m.savedCount}개 저장됨`
                      : m.module
                        ? `${MODULE_LABEL[m.module] ?? m.module}${m.action === 'delete' ? ' 삭제됨' : m.action === 'update' ? ' 수정됨' : ' 저장됨'}`
                        : '저장됨'
                    }
                  </span>
                )}

                {m.role === 'ai' && m.action === 'delete_pending' && m.pendingFilter && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button
                      onClick={() => handleConfirmDelete(m.id, m.module!, m.pendingFilter!)}
                      disabled={m.confirmLoading}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {m.confirmLoading ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      삭제 확인
                    </button>
                    <button
                      onClick={() => handleCancelDelete(m.id)}
                      disabled={m.confirmLoading}
                      className="px-3 py-1 text-slate-400 text-xs rounded-lg hover:text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                )}

                {m.role === 'ai' && m.suggestions && m.suggestions.length > 0 && !loading && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.suggestions.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-[11px] px-2.5 py-1 bg-white border border-slate-200 text-slate-500 rounded-full hover:border-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-50 shrink-0">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder="오늘 러닝 40분 했어&#10;요즘 내 생활 어때? 로드맵 진행 현황은?"
                rows={2}
                disabled={loading}
                style={{ minHeight: '60px' }}
                className="w-full resize-none border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 leading-relaxed overflow-hidden"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2.5 bottom-2.5 w-7 h-7 flex items-center justify-center bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-300 mt-1.5 px-0.5">Enter 전송 · Shift+Enter 줄바꿈</p>
          </div>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-slate-700 hover:bg-slate-600 rotate-0'
            : 'bg-slate-900 hover:bg-slate-700'
        }`}
        title="AI 어시스턴트"
      >
        {open ? <X size={20} className="text-white" /> : <Bot size={22} className="text-white" />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-500 text-white text-[9px] rounded-full flex items-center justify-center font-medium">
            {messages.length > 99 ? '99' : messages.length}
          </span>
        )}
      </button>
    </>
  );
}
