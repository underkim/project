'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { careerApi } from '@/lib/api';
import type { CareerSettingsResponse, CFRatingLogResponse } from '@/types';

const cfRanks = ['newbie','pupil','specialist','expert','candidate master','master','international master','grandmaster','legendary grandmaster'];

const ratingColor = (rating: number) => {
  if (rating >= 3000) return '#ff0000';
  if (rating >= 2400) return '#ff8c00';
  if (rating >= 2100) return '#ff8c00';
  if (rating >= 1900) return '#aa00aa';
  if (rating >= 1600) return '#0000ff';
  if (rating >= 1400) return '#03a89e';
  if (rating >= 1200) return '#008000';
  return '#808080';
};

export default function CareerPage() {
  const [settings, setSettings] = useState<CareerSettingsResponse>({ cf_handle: null, github_username: null, blog_url: null });
  const [ratings, setRatings] = useState<CFRatingLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingForm, setRatingForm] = useState({ log_date: '', rating: '', rank_name: 'pupil' });

  async function load() {
    setError(null);
    try {
      const [s, r] = await Promise.all([careerApi.getSettings(), careerApi.listCFRatings()]);
      setSettings(s);
      setRatings(r);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setRatingForm(f => ({ ...f, log_date: today }));
    load();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await careerApi.updateSettings({
        cf_handle: settings.cf_handle || undefined,
        github_username: settings.github_username || undefined,
        blog_url: settings.blog_url || undefined,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch {
      setError('저장에 실패했습니다.');
    }
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    try {
      await careerApi.createCFRating({
        log_date: ratingForm.log_date,
        rating: Number(ratingForm.rating),
        rank_name: ratingForm.rank_name,
      });
      setRatingForm(f => ({ ...f, rating: '', rank_name: 'pupil' }));
      setShowRatingForm(false);
      await load();
    } catch {
      setError('레이팅 저장에 실패했습니다.');
    }
  }

  async function deleteRating(id: number) {
    try {
      await careerApi.deleteCFRating(id);
      await load();
    } catch {
      setError('삭제에 실패했습니다.');
    }
  }

  const latestRating = ratings[0];
  const chartData = [...ratings].reverse().map(r => ({ date: r.log_date.slice(5), rating: r.rating, rank: r.rank_name }));

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">커리어</h1>

      {error && (
        <div className="flex items-center justify-between border border-red-100 bg-red-50 rounded-lg px-4 py-2.5 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 text-xs">✕</button>
        </div>
      )}

      {latestRating && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">Codeforces 최신 레이팅</p>
          <p className="text-3xl font-semibold text-slate-900">{latestRating.rating}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{latestRating.rank_name} · {latestRating.log_date}</p>
        </div>
      )}

      {/* CF 레이팅 추이 차트 */}
      {chartData.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">레이팅 추이</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={['dataMin - 100', 'dataMax + 100']} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                formatter={(v, _, props) => [
                  `${v} (${props.payload?.rank ?? ''})`,
                  '레이팅',
                ]}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#0f172a"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  return <circle key={payload.date} cx={cx} cy={cy} r={4} fill={ratingColor(payload.rating)} stroke="#fff" strokeWidth={1.5} />;
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 프로필 설정 */}
      <div className="border border-slate-100 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-800 mb-4">프로필 설정</p>
        <form onSubmit={saveSettings} className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Codeforces 핸들</label>
            <input type="text" value={settings.cf_handle ?? ''}
              onChange={e => setSettings({ ...settings, cf_handle: e.target.value || null })}
              placeholder="예: tourist"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">GitHub 사용자명</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">github.com/</span>
              <input type="text" value={settings.github_username ?? ''}
                onChange={e => setSettings({ ...settings, github_username: e.target.value || null })}
                placeholder="username"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">블로그 URL</label>
            <input type="text" value={settings.blog_url ?? ''}
              onChange={e => setSettings({ ...settings, blog_url: e.target.value || null })}
              placeholder="https://..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button type="submit"
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              저장
            </button>
            {settingsSaved && <span className="text-green-600 text-sm">✓ 저장되었습니다</span>}
          </div>
        </form>
      </div>

      {/* CF 레이팅 기록 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">CF 레이팅 기록</p>
          <button onClick={() => setShowRatingForm(!showRatingForm)}
            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">+ 추가</button>
        </div>
        {showRatingForm && (
          <form onSubmit={submitRating} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">날짜</label>
                <input type="date" value={ratingForm.log_date}
                  onChange={e => setRatingForm({ ...ratingForm, log_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">레이팅</label>
                <input type="number" min="0" max="4000" value={ratingForm.rating}
                  onChange={e => setRatingForm({ ...ratingForm, rating: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" required />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">랭크</label>
                <select value={ratingForm.rank_name}
                  onChange={e => setRatingForm({ ...ratingForm, rank_name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                  {cfRanks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowRatingForm(false)} className="text-sm text-slate-500">취소</button>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">저장</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-100">
          {ratings.length === 0
            ? <p className="text-slate-400 text-sm text-center py-6">레이팅 기록이 없습니다</p>
            : ratings.map((r, i) => {
              const prev = ratings[i + 1];
              const diff = prev ? r.rating - prev.rating : null;
              return (
                <div key={r.id} className="flex items-center px-5 py-3 gap-4">
                  <span className="text-slate-400 text-xs w-24 shrink-0">{r.log_date}</span>
                  <span className="font-bold text-slate-800 text-sm" style={{ color: ratingColor(r.rating) }}>{r.rating}</span>
                  <span className="text-slate-500 text-xs capitalize">{r.rank_name}</span>
                  {diff !== null && (
                    <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                  <button onClick={() => deleteRating(r.id)}
                    className="ml-auto text-slate-300 hover:text-red-400 text-xs">삭제</button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
