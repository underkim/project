'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import type { ToastType } from '@/lib/toast';

type ToastItem = { id: number; message: string; type: ToastType };

let _id = 0;

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = ++_id;
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto
            transition-all duration-300 max-w-sm
            ${t.type === 'success' ? 'bg-slate-900 text-white' :
              t.type === 'error' ? 'bg-red-600 text-white' :
              'bg-slate-700 text-white'}`}
        >
          {t.type === 'success' && <CheckCircle2 size={15} className="shrink-0" />}
          {t.type === 'error' && <XCircle size={15} className="shrink-0" />}
          {t.type === 'info' && <Info size={15} className="shrink-0" />}
          <span>{t.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
