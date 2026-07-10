'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import AiModal from '@/components/AiModal';
import { Menu } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      const current = window.location.pathname + window.location.search;
      const next = encodeURIComponent(current);
      router.replace(`/login?next=${next}`);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <div
        className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 md:ml-56 overflow-y-auto flex flex-col min-h-0">
        {/* 모바일 상단 헤더 */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="메뉴 열기"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-slate-900">Life Dashboard</span>
        </div>

        <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</div>
      </main>

      <Toast />
      <AiModal />
    </div>
  );
}
