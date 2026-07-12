'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Loader2,
  X,
  CheckCircle2,
  Trash2,
  Eraser,
  ChevronDown,
  Copy,
  Check,
  ChevronsDown,
  BarChart2,
  ShieldAlert,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import type { AiChatResponse } from '@/lib/api';
import { showToast } from '@/lib/toast';

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

// ── localStorage safe helpers ──────────────────────────────────

const HISTORY_KEY = 'ai-chat-history';
const CONTEXT_KEY = 'ai-context-sharing';
const HISTORY_LIMIT = 40;

type StoredMessage = Omit<Message, 'confirmLoading' | 'pendingFilter'> & {
  action?: string | null;
};

function safeLoadHistory(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Message[];
  } catch {
    return [];
  }
}

function safeSaveHistory(msgs: Message[], onQuotaWarn: () => void): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave: StoredMessage[] = msgs.slice(-HISTORY_LIMIT).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      saved: m.saved,
      savedCount: m.savedCount,
      module: m.module,
      modules: m.modules,
      // pending delete confirmation must not be restored as active
      action: m.action === 'delete_pending' ? null : m.action,
      timestamp: m.timestamp,
      dateLabel: m.dateLabel,
      suggestions: m.suggestions,
      // confirmLoading and pendingFilter intentionally excluded
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      onQuotaWarn();
    }
  }
}

function safeClearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ── 복사 버튼 ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard unavailable — do not show false success */
      });
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
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-800">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function parseInlineCode(text: string) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono"
          >
            {part}
          </code>
        ) : (
          <Fragment key={i}>{parseBold(part)}</Fragment>
        ),
      )}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  // 코드블록(```) 먼저 분리
  const segments = text.split(/(```[\s\S]*?```)/);
  return (
    <>
      {segments.map((seg, si) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3).replace(/^\w+\n/, '');
          return (
            <pre
              key={si}
              className="mt-1.5 mb-1.5 bg-slate-800 text-emerald-300 text-[11px] font-mono rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre leading-relaxed"
            >
              {inner}
            </pre>
          );
        }
        const lines = seg.split('\n');
        return (
          <Fragment key={si}>
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
                  {(si > 0 || i > 0) && <br />}
                  {isBullet && <span className="mr-1 select-none text-slate-400">•</span>}
                  {isHeading ? (
                    <strong className="font-semibold text-slate-800">
                      {parseInlineCode(content)}
                    </strong>
                  ) : (
                    parseInlineCode(content)
                  )}
                </Fragment>
              );
            })}
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
  tracker_entry: '나의 기록',
};

// 삭제 필터 키 → 사용자 친화 라벨
const FILTER_KEY_LABEL: Record<string, string> = {
  id: 'ID',
  log_date: '날짜',
  record_date: '날짜',
  date: '날짜',
  title: '제목',
  name: '이름',
  text: '내용',
  exercise_type: '운동 종류',
  activity_type: '활동 종류',
  rank_name: '랭크',
  destination: '목적지',
  trip_name: '여행명',
  tracker_name: 'Tracker',
  entry_date: '날짜',
  category: '카테고리',
  status: '상태',
};

// 삭제 필터 값을 안전하게 한 줄 문자열로 변환 (중첩 객체/긴 값 방지)
function formatFilterValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return null;
    return v.length > 40 ? v.slice(0, 40) + '…' : v;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const prims = value.filter((x) => ['string', 'number', 'boolean'].includes(typeof x));
    if (prims.length === 0) return `${value.length}개 항목`;
    const joined = prims.slice(0, 5).map(String).join(', ');
    const text = prims.length > 5 ? `${joined} 외 ${prims.length - 5}개` : joined;
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
  }
  // 중첩 객체 등은 그대로 렌더링하지 않는다
  return null;
}

function DeleteFilterPreview({
  module,
  filter,
}: {
  module: string | null;
  filter: Record<string, unknown>;
}) {
  const entries = Object.entries(filter)
    .map(([k, v]) => [k, formatFilterValue(v)] as const)
    .filter((e): e is readonly [string, string] => e[1] !== null);
  const moduleLabel = module ? (MODULE_LABEL[module] ?? module) : null;
  return (
    <div className="mt-1.5 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-[11px] text-slate-600 max-w-[85%]">
      <p className="font-semibold text-red-600 mb-1">삭제 대상 확인</p>
      {moduleLabel && (
        <div className="flex gap-1.5">
          <span className="text-slate-400 shrink-0">항목</span>
          <span className="font-medium text-slate-700">{moduleLabel}</span>
        </div>
      )}
      {entries.length > 0 ? (
        entries.map(([k, v]) => (
          <div key={k} className="flex gap-1.5">
            <span className="text-slate-400 shrink-0">{FILTER_KEY_LABEL[k] ?? k}</span>
            <span className="text-slate-700 break-all">{v}</span>
          </div>
        ))
      ) : (
        <p className="text-slate-400 mt-0.5">조건에 맞는 전체 항목</p>
      )}
    </div>
  );
}

let msgId = Date.now();

export function dispatchAiSaved(module: string | null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-data-saved', { detail: { module } }));
  }
}

const MODULE_PATHS: Record<string, { path: string; name: string }> = {
  planner_item: { path: '/planner', name: '플래너' },
  finance_record: { path: '/finance', name: '재테크' },
  health_exercise: { path: '/health', name: '건강' },
  health_sleep: { path: '/health', name: '건강' },
  growth_book: { path: '/growth', name: '자기계발' },
  growth_english: { path: '/growth', name: '자기계발' },
  career_cf_rating: { path: '/career', name: '커리어' },
  travel_trip: { path: '/travel', name: '여행' },
  travel_plan: { path: '/travel', name: '여행' },
  travel_checklist: { path: '/travel', name: '여행' },
  tracker_entry: { path: '/trackers', name: '나의 기록' },
};

// 채팅은 어느 페이지에서든 열 수 있는 FAB이므로, 저장이 실제로 반영된 모듈 페이지로
// 바로 이동할 수 있는 액션 링크를 토스트에 붙인다. 현재 보고 있는 페이지와 같아도
// 해가 되지 않으므로 매핑이 있으면 항상 붙인다.
// 메시지에 모듈명을 포함시켜, 서로 다른 모듈에 대한 저장이 토스트 중복 억제(동일
// message+type 무시)로 뭉개져 두 번째 액션 링크가 사라지는 일이 없도록 한다.
function notifySaved(module: string | null) {
  if (!module) return;
  const target = MODULE_PATHS[module];
  if (!target) return;
  showToast(`${target.name}에 저장했어요.`, 'success', { label: '바로가기', href: target.path });
}

export default function AiModal() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [weeklyReportLoading, setWeeklyReportLoading] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(() =>
    typeof window === 'undefined' ? true : localStorage.getItem(CONTEXT_KEY) !== 'false',
  );
  const quotaWarnedRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const msgs = safeLoadHistory();
    if (msgs.length > 0) msgId = Math.max(msgId, ...msgs.map((m) => m.id));
    return msgs;
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // 사용자가 메시지 영역의 바닥 근처에 있는지 추적 (위로 읽는 중이면 자동 스크롤 안 함)
  const atBottomRef = useRef(true);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // 모달을 열면 즉시 바닥으로 이동하고 입력창에 포커스
  useEffect(() => {
    if (!open) return;
    atBottomRef.current = true;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    });
    inputRef.current?.focus();
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 접근성: 열려 있을 때 Escape로 닫기, 닫히면 FAB로 포커스 복원
  useEffect(() => {
    if (!open) return;
    const fab = fabRef.current; // 트리거 버튼은 항상 렌더되므로 setup 시점 참조가 안정적
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // 모달이 닫힐 때(언마운트/open=false) 트리거 버튼으로 포커스 되돌림
      fab?.focus();
    };
  }, [open]);

  // 새 메시지: 사용자가 바닥 근처에 있을 때만 자동 스크롤 (위로 읽는 중이면 유지)
  useEffect(() => {
    if (!open || !atBottomRef.current) return;
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [messages, open]);

  function handleScroll() {
    const el = scrollAreaRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = fromBottom < 80;
    setShowScrollBtn(fromBottom > 100);
  }

  function scrollToBottom() {
    atBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    safeSaveHistory(messages, () => {
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        showToast(
          '저장 공간이 부족해 대화 기록을 저장하지 못했어요. 채팅은 계속 사용할 수 있어요.',
          'error',
        );
      }
    });
  }, [messages]);

  function getHistory() {
    return messages.slice(-20).map((m) => {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msgDay = new Date(d);
    msgDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
    const dateLabel =
      diffDays === 0
        ? ''
        : diffDays === 1
          ? '어제 '
          : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ';
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
    setMessages((prev) => [...prev, aiMsg]);
    if (res.saved) {
      const mods = res.modules ?? (res.module ? [res.module] : []);
      mods.forEach((m) => {
        dispatchAiSaved(m);
        notifySaved(m);
      });
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const { time, dateLabel } = makeTimestamp();
    setMessages((prev) => [
      ...prev,
      { id: ++msgId, role: 'user', text, timestamp: time, dateLabel },
    ]);
    setLoading(true);
    try {
      const res = await aiApi.chat(text, getHistory(), contextEnabled);
      applyAiResponse(res);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const errText =
        status === 429
          ? 'API 할당량 초과예요. Google AI Studio에서 키를 재발급해주세요.'
          : (detail ?? '요청에 실패했어요. 잠시 후 다시 시도해주세요.');
      setMessages((prev) => [...prev, { id: ++msgId, role: 'ai', text: errText }]);
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

  async function handleConfirmDelete(
    msgLocalId: number,
    module: string,
    filter: Record<string, unknown>,
  ) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgLocalId ? { ...m, confirmLoading: true } : m)),
    );
    try {
      const res = await aiApi.execute(module, filter);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgLocalId
            ? {
                ...m,
                confirmLoading: false,
                action: 'delete',
                saved: res.saved,
                pendingFilter: null,
              }
            : m,
        ),
      );
      if (res.saved) dispatchAiSaved(module);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgLocalId
            ? {
                ...m,
                confirmLoading: false,
                pendingFilter: null,
                text: m.text + '\n\n⚠️ 삭제 중 오류가 발생했습니다.',
              }
            : m,
        ),
      );
    }
  }

  function handleCancelDelete(msgLocalId: number) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgLocalId ? { ...m, action: null, pendingFilter: null } : m)),
    );
  }

  function clearChat() {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    setMessages([]);
    safeClearHistory();
    setClearConfirm(false);
  }

  async function handleWeeklyReport() {
    if (weeklyReportLoading || loading) return;
    if (!contextEnabled) {
      showToast('주간 리포트를 만들려면 Dashboard context 공유를 켜주세요.', 'info');
      return;
    }
    const { time, dateLabel } = makeTimestamp();
    setMessages((prev) => [
      ...prev,
      { id: ++msgId, role: 'user', text: '주간 리포트 생성해줘', timestamp: time, dateLabel },
    ]);
    setWeeklyReportLoading(true);
    setLoading(true);
    try {
      const { report } = await aiApi.weeklyReport();
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgId,
          role: 'ai',
          text: report,
          timestamp: makeTimestamp().time,
          dateLabel: makeTimestamp().dateLabel,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgId,
          role: 'ai',
          text: '주간 리포트를 가져오지 못했어요. 잠시 후 다시 시도해주세요.',
        },
      ]);
    } finally {
      setWeeklyReportLoading(false);
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* 모달 패널 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI 어시스턴트"
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[420px] h-[min(70vh,560px)] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">AI 어시스턴트</p>
                <p className="text-[10px] text-slate-400">
                  기록·수정·삭제·분석·조언 — 자유롭게 대화해요
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleWeeklyReport}
                disabled={weeklyReportLoading || loading}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                title="주간 리포트"
              >
                {weeklyReportLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <BarChart2 size={12} />
                )}
                <span className="hidden sm:inline">주간 리포트</span>
              </button>
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

          <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-800" role="note">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1"><p>AI 대화와 관련 Dashboard 정보가 외부 Gemini 서비스로 전송될 수 있습니다. 비밀번호, API key 등 민감정보는 입력하지 마세요.</p><label className="mt-1.5 flex items-center gap-2 font-medium"><input type="checkbox" checked={contextEnabled} onChange={(event)=>{const enabled=event.target.checked;setContextEnabled(enabled);localStorage.setItem(CONTEXT_KEY,String(enabled));}}/>저장된 Dashboard context 함께 보내기</label></div>
          </div>

          {/* 메시지 영역 */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollAreaRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto px-4 py-3 flex flex-col gap-3"
            >
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <Bot size={22} className="text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">무엇을 도와드릴까요?</p>
                    <p className="text-xs text-slate-400 mt-1">
                      기록·조회·분석·조언 뭐든지 말해봐요
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-1">
                    <button
                      onClick={handleWeeklyReport}
                      disabled={weeklyReportLoading}
                      className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-full transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {weeklyReportLoading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <span>📋</span>
                      )}
                      <span>주간 리포트</span>
                    </button>
                    {[
                      { text: '이번 주 어땠어?', icon: '📊' },
                      { text: '오늘 러닝 40분', icon: '🏃' },
                      { text: '다음 우선순위 뭐야?', icon: '🎯' },
                      { text: '요즘 생활 분석해줘', icon: '💡' },
                      { text: '오늘 운동 40분 기록해줘', icon: '🏃' },
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

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-slate-900 text-white rounded-br-sm whitespace-pre-wrap'
                        : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {m.role === 'ai' ? <MarkdownText text={m.text} /> : m.text}
                    {m.role === 'ai' && (
                      <span className="absolute -top-1 -right-1">
                        <CopyButton text={m.text} />
                      </span>
                    )}
                  </div>

                  {m.timestamp && (
                    <span className="mt-0.5 text-[10px] text-slate-300 px-1">
                      {m.dateLabel}
                      {m.timestamp}
                    </span>
                  )}

                  {m.role === 'ai' && m.saved && (
                    <span className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                      <CheckCircle2 size={11} />
                      {m.savedCount && m.savedCount > 1
                        ? `${m.savedCount}개 저장됨`
                        : m.module
                          ? `${MODULE_LABEL[m.module] ?? m.module}${m.action === 'delete' ? ' 삭제됨' : m.action === 'update' ? ' 수정됨' : ' 저장됨'}`
                          : '저장됨'}
                    </span>
                  )}

                  {m.role === 'ai' && m.action === 'delete_pending' && m.pendingFilter && (
                    <DeleteFilterPreview module={m.module ?? null} filter={m.pendingFilter} />
                  )}

                  {m.role === 'ai' && m.action === 'delete_pending' && m.pendingFilter && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        onClick={() => handleConfirmDelete(m.id, m.module!, m.pendingFilter!)}
                        disabled={m.confirmLoading}
                        className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                      >
                        {m.confirmLoading ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
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
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {showScrollBtn && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 right-3 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-all"
                title="최신 메시지로"
              >
                <ChevronsDown size={14} />
              </button>
            )}
          </div>

          {/* 입력창 */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-50 shrink-0">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
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
            <p className="text-[10px] text-slate-300 mt-1.5 px-0.5">
              Enter 전송 · Shift+Enter 줄바꿈
            </p>
          </div>
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        ref={fabRef}
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-200 ${
          open ? 'bg-slate-700 hover:bg-slate-600 rotate-0' : 'bg-slate-900 hover:bg-slate-700'
        }`}
        title="AI 어시스턴트"
        aria-label={open ? 'AI 어시스턴트 닫기' : 'AI 어시스턴트 열기'}
        aria-expanded={open}
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
