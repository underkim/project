'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bot, Send, Loader2, X, CheckCircle2, Trash2, Eraser, ChevronDown,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import type { AiChatResponse } from '@/lib/api';

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

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const toSave = messages.slice(-30).map(m => ({
      ...m,
      confirmLoading: false,
    }));
    localStorage.setItem('ai-chat-history', JSON.stringify(toSave));
  }, [messages]);

  function getHistory() {
    return messages.slice(-10).map(m => ({ role: m.role === 'user' ? 'user' : 'ai', text: m.text }));
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
    if (res.saved && res.module) dispatchAiSaved(res.module);
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: ++msgId, role: 'user', text, timestamp: now }]);
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
    setMessages([]);
    localStorage.removeItem('ai-chat-history');
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
                <p className="text-[10px] text-slate-400">운동 30분, 책 추가, 기록 수정 등</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                  title="대화 초기화"
                >
                  <Eraser size={14} />
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
                  <p className="text-xs text-slate-400 mt-1">자연어로 기록하거나 질문해보세요</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {['오늘 러닝 30분 했어', '이번 달 운동 몇 번?', '파친코 읽기 시작했어'].map(ex => (
                    <button
                      key={ex}
                      onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-sm'
                    : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>

                {m.timestamp && (
                  <span className="mt-0.5 text-[10px] text-slate-300 px-1">{m.timestamp}</span>
                )}

                {m.role === 'ai' && m.saved && m.module && (
                  <span className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                    <CheckCircle2 size={11} />
                    {MODULE_LABEL[m.module] ?? m.module}
                    {m.action === 'delete' ? ' 삭제됨' : m.action === 'update' ? ' 수정됨' : ' 저장됨'}
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
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="오늘 러닝 30분 했어&#10;이번 달 운동 몇 번?"
                rows={2}
                disabled={loading}
                className="w-full resize-none border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 leading-relaxed"
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
