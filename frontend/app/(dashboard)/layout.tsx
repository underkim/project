'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.replace('/login');
    else setReady(true);
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
      <Sidebar />
      <main className="flex-1 ml-56 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
