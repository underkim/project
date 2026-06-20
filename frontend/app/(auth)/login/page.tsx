'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(username, password);
      localStorage.setItem('token', data.access_token);
      router.replace('/');
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6">
        <div className="mb-10">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center mb-5">
            <span className="text-white text-lg font-bold">L</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Life Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">계속하려면 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">아이디</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs py-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
