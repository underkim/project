'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { careerApi, exportApi } from '@/lib/api';
import type { CareerSettingsResponse, CFRatingLogResponse } from '@/types';
import { Trash2, Download } from 'lucide-react';

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

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="flex items-center gap-1 ml-auto">
      <button onClick={onConfirm} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">확인</button>
      <button onClick={onCancel} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors">취소</button>
    </span>
  );
}

const PAGE = 20;

export default function CareerPage() {
  const [settings, setSettings] = useState<CareerSettingsResponse>({ cf_handle: null, github_username: null, blog_url: null });
  const [ratings, setRatings] = useState<CFRatingLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingForm, setRatingForm] = useState({ log_date: '', rating: '', rank_name: 'pupil' });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    try {
      const [s, r] = await Promise.all([careerApi.getSettings(), careerApi.listCFRatings(PAGE)]);
      setSettings(s);
      setRatings(r); setHasMore(r.length === PAGE);
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadMore(true);
    try {
      const more = await careerApi.listCFRatings(PAGE, ratings.length);
      setRatings(prev => [...prev, ...more]);
      setHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setLoadMore(false); }
  }

  useEffect(() => {
    setRatingForm(f => ({ ...f, log_date: new Date().toISOString().slice(0, 10) }));
    load();
  }, []);

  useAiRefresh(['career'], load);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await careerApi.updateSettings({
        cf_handle: settings.cf_handle || undefined,
        github_username: settings.github_username || undefined,
        blog_url: settings.blog_url || undefined,
      });
      showToast('프로필 저장됨');
    } catch {
      showToast('저장에 실패했습니다.', 'error');
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
      showToast('레이팅 기록 저장됨');
      await load();
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    }
  }

  async function deleteRating(id: number) {
    try {
      await careerApi.deleteCFRating(id);
      setDeletingId(null);
      showToast('레이팅 기록 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
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

      {latestRating && (
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">Codeforces 최신 레이팅</p>
          <p className="text-3xl font-semibold text-slate-900">{latestRating.rating}</p>
          <p className="text-xs text-slate-400 mt-1 capitalize">{latestRating.rank_name} · {latestRating.log_date}</p>
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">레이팅 추이</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={['dataMin - 100', 'dataMax + 100']} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v, _, props) => [`${v} (${props.payload?.rank ?? ''})`, '레이팅']} />
              <Line
                type="monotone" dataKey="rating" stroke="#0f172a" strokeWidth={2}
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
          <div className="pt-1">
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              저장
            </button>
          </div>
        </form>
      </div>

      {/* CF 레이팅 기록 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">CF 레이팅 기록</p>
          <div className="flex items-center gap-2">
            <button onClick={() => exportApi.career()} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <Download size={14} />
            </button>
            <button onClick={() => setShowRatingForm(!showRatingForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">+ 추가</button>
          </div>
        </div>
        {showRatingForm && (
          <form onSubmit={submitRating} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          {ratings.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">레이팅 기록이 없어요</p>
              <button onClick={() => setShowRatingForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 레이팅 기록하기</button>
            </div>
          ) : ratings.map((r, i) => {
            const prev = ratings[i + 1];
            const diff = prev ? r.rating - prev.rating : null;
            return (
              <div key={r.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors">
                <span className="text-slate-400 text-xs w-24 shrink-0">{r.log_date}</span>
                <span className="font-bold text-slate-800 text-sm" style={{ color: ratingColor(r.rating) }}>{r.rating}</span>
                <span className="text-slate-500 text-xs capitalize hidden sm:block">{r.rank_name}</span>
                {diff !== null && (
                  <span className={`text-xs font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                )}
                {deletingId === r.id ? (
                  <DeleteConfirm onConfirm={() => deleteRating(r.id)} onCancel={() => setDeletingId(null)} />
                ) : (
                  <button onClick={() => setDeletingId(r.id)} className="ml-auto text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {hasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={handleLoadMore} disabled={loadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {loadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
