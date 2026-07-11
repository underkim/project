'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import type { ToastAction, ToastType } from '@/lib/toast';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
  createdAt: number;
};

let _id = 0;

const DEDUPE_MS = 2000; // 같은 메시지+타입이 이 시간 내 반복되면 무시
const MAX_VISIBLE = 4; // 동시에 표시할 최대 토스트 수
const AUTO_DISMISS_MS = 3500;

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // 동기적으로 dedupe/cap 판단을 하기 위한 source-of-truth 미러
  const toastsRef = useRef<ToastItem[]>([]);

  const commit = useCallback((next: ToastItem[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      commit(toastsRef.current.filter((t) => t.id !== id));
    },
    [commit],
  );

  useEffect(() => {
    function handler(e: Event) {
      const { message, type, action } = (
        e as CustomEvent<{ message: string; type: ToastType; action?: ToastAction }>
      ).detail;
      const now = Date.now();
      // 중복 억제: 동일 message+type이 짧은 시간 내 이미 떠 있으면 무시
      if (
        toastsRef.current.some(
          (t) => t.message === message && t.type === type && now - t.createdAt < DEDUPE_MS,
        )
      ) {
        return;
      }
      const id = ++_id;
      let next = [...toastsRef.current, { id, message, type, action, createdAt: now }];
      // 최대 개수 초과 시 가장 오래된 것부터 제거
      if (next.length > MAX_VISIBLE) next = next.slice(next.length - MAX_VISIBLE);
      commit(next);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    }
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, [commit, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto
            transition-all duration-300 max-w-sm
            ${
              t.type === 'success'
                ? 'bg-slate-900 text-white'
                : t.type === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-white'
            }`}
        >
          {t.type === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
          {t.type === 'error' && <XCircle size={15} className="shrink-0" />}
          {t.type === 'info' && <Info size={15} className="shrink-0" />}
          <span>{t.message}</span>
          {t.action && (
            <Link
              href={t.action.href}
              onClick={() => dismiss(t.id)}
              className="underline underline-offset-2 shrink-0 opacity-90 hover:opacity-100 transition-opacity"
            >
              {t.action.label}
            </Link>
          )}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="알림 닫기"
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
