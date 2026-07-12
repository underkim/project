'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ title, description, onClose, children }: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
    <button className="absolute inset-0 bg-slate-900/35" onClick={onClose} aria-label="대화상자 닫기" />
    <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="dialog-title" className="text-lg font-semibold text-slate-900">{title}</h2>{description&&<p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
        <button onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><X size={18}/></button>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  </div>;
}
