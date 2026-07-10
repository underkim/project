'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import { emitGoalChange } from '@/lib/goals';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { careerApi, exportApi } from '@/lib/api';
import type { CareerSettingsResponse, CFRatingLogResponse } from '@/types';
import {
  Trash2,
  Download,
  ExternalLink,
  Target,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const cfRanks = [
  'newbie',
  'pupil',
  'specialist',
  'expert',
  'candidate master',
  'master',
  'international master',
  'grandmaster',
  'legendary grandmaster',
];

function inferRank(rating: number): string {
  if (rating >= 3000) return 'legendary grandmaster';
  if (rating >= 2600) return 'grandmaster';
  if (rating >= 2400) return 'international master';
  if (rating >= 2300) return 'master';
  if (rating >= 2100) return 'candidate master';
  if (rating >= 1900) return 'expert';
  if (rating >= 1600) return 'specialist';
  if (rating >= 1200) return 'pupil';
  return 'newbie';
}

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

function DeleteConfirm({
  onConfirm,
  onCancel,
  disabled,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 ml-auto">
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {disabled ? <Loader2 size={10} className="animate-spin inline" /> : '확인'}
      </button>
      <button
        onClick={onCancel}
        disabled={disabled}
        className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
      >
        취소
      </button>
    </span>
  );
}

const PAGE = 20;

export default function CareerPage() {
  const [settings, setSettings] = useState<CareerSettingsResponse>({
    cf_handle: null,
    github_username: null,
    blog_url: null,
  });
  const [ratings, setRatings] = useState<CFRatingLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    rating: '',
    rank_name: 'pupil',
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingRating, setEditingRating] = useState<{
    id: number;
    log_date: string;
    rating: string;
    rank_name: string;
  } | null>(null);
  const [chartYear, setChartYear] = useState<string>('all');
  const CF_GOAL_KEY = 'cf_rating_goal';
  const [cfGoal, setCfGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('cf_rating_goal') ?? '0', 10) || 0;
  });
  const [editingCfGoal, setEditingCfGoal] = useState(false);
  const [cfGoalInput, setCfGoalInput] = useState('');
  const [exporting, setExporting] = useState<Set<string>>(new Set());
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  async function withMutation(key: string, fn: () => Promise<void>) {
    if (mutating.has(key)) return;
    setMutating((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setMutating((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleExport(key: string, fn: () => Promise<void>) {
    if (exporting.has(key)) return;
    setExporting((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setExporting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function load() {
    setLoadError(false);
    try {
      const [s, r] = await Promise.all([careerApi.getSettings(), careerApi.listCFRatings(PAGE)]);
      setSettings(s);
      setRatings(r);
      setHasMore(r.length === PAGE);
    } catch {
      setLoadError(true);
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadMore(true);
    try {
      const more = await careerApi.listCFRatings(PAGE, ratings.length);
      setRatings((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE);
    } catch {
      showToast('불러오지 못했습니다.', 'error');
    } finally {
      setLoadMore(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useAiRefresh(['career'], load);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('settings_save', async () => {
      let blogUrl = settings.blog_url;
      if (blogUrl && !/^https?:\/\//i.test(blogUrl)) {
        blogUrl = 'https://' + blogUrl;
      }
      try {
        const updated = await careerApi.updateSettings({
          cf_handle: settings.cf_handle,
          github_username: settings.github_username,
          blog_url: blogUrl,
        });
        setSettings(updated);
        showToast('프로필 저장됨');
      } catch (err: unknown) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
        showToast(typeof detail === 'string' ? detail : '저장에 실패했습니다.', 'error');
      }
    });
  }

  async function updateRating() {
    if (!editingRating) return;
    await withMutation(`rating_update_${editingRating.id}`, async () => {
      try {
        await careerApi.updateCFRating(editingRating.id, {
          log_date: editingRating.log_date,
          rating: Number(editingRating.rating),
          rank_name: editingRating.rank_name,
        });
        setEditingRating(null);
        showToast('레이팅 기록 수정됨');
        await load();
      } catch {
        showToast('수정에 실패했습니다.', 'error');
      }
    });
  }

  function saveRatingGoal() {
    const v = parseInt(cfGoalInput, 10);
    if (v > 0) {
      localStorage.setItem(CF_GOAL_KEY, String(v));
      setCfGoal(v);
      emitGoalChange();
    }
    setEditingCfGoal(false);
  }

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    await withMutation('rating_create', async () => {
      try {
        await careerApi.createCFRating({
          log_date: ratingForm.log_date,
          rating: Number(ratingForm.rating),
          rank_name: ratingForm.rank_name,
        });
        setRatingForm((f) => ({ ...f, rating: '', rank_name: 'pupil' }));
        setShowRatingForm(false);
        showToast('레이팅 기록 저장됨');
        await load();
      } catch {
        showToast('저장에 실패했습니다.', 'error');
      }
    });
  }

  async function deleteRating(id: number) {
    await withMutation(`rating_delete_${id}`, async () => {
      try {
        await careerApi.deleteCFRating(id);
        setDeletingId(null);
        showToast('레이팅 기록 삭제됨');
        await load();
      } catch {
        showToast('삭제에 실패했습니다.', 'error');
      }
    });
  }

  const latestRating = ratings[0];
  const maxRating = ratings.length > 0 ? Math.max(...ratings.map((r) => r.rating)) : null;
  const maxRatingRecord = ratings.find((r) => r.rating === maxRating);
  const ratingYears = [...new Set(ratings.map((r) => r.log_date.slice(0, 4)))].sort();
  const filteredForChart =
    chartYear === 'all' ? ratings : ratings.filter((r) => r.log_date.startsWith(chartYear));
  const chartData = [...filteredForChart]
    .reverse()
    .map((r) => ({ date: r.log_date.slice(5), rating: r.rating, rank: r.rank_name }));

  // 레이팅 성장 속도 (첫 기록 ~ 최신 기록 기간 기준 월평균)
  const growthStats = (() => {
    if (ratings.length < 2) return null;
    const first = ratings[ratings.length - 1];
    const latest = ratings[0];
    const days = Math.round(
      (new Date(latest.log_date).getTime() - new Date(first.log_date).getTime()) / 86400000,
    );
    if (days <= 0) return null;
    const totalGrowth = latest.rating - first.rating;
    const monthlyGrowth = Math.round((totalGrowth / days) * 30);
    return { totalGrowth, monthlyGrowth, days };
  })();

  // 최근 3회 연속 하락 감지
  const recentDecline =
    ratings.length >= 3 &&
    ratings[0].rating < ratings[1].rating &&
    ratings[1].rating < ratings[2].rating;

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">커리어</h1>

      {loadError && (
        <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            데이터를 불러오지 못했습니다.
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors shrink-0"
          >
            <RefreshCw size={12} />
            다시 시도
          </button>
        </div>
      )}

      {latestRating && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-slate-100 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-400">현재 레이팅</p>
              {editingCfGoal ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="4000"
                    value={cfGoalInput}
                    onChange={(e) => setCfGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRatingGoal();
                      if (e.key === 'Escape') setEditingCfGoal(false);
                    }}
                    autoFocus
                    placeholder="목표"
                    className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    onClick={saveRatingGoal}
                    className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCfGoalInput(cfGoal > 0 ? String(cfGoal) : '');
                    setEditingCfGoal(true);
                  }}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <Target size={10} />
                  {cfGoal > 0 ? `목표 ${cfGoal}` : '목표 설정'}
                </button>
              )}
            </div>
            <p
              className="text-3xl font-semibold"
              style={{ color: ratingColor(latestRating.rating) }}
            >
              {latestRating.rating}
            </p>
            <p className="text-xs text-slate-400 mt-1 capitalize">{latestRating.rank_name}</p>
            <p className="text-[10px] text-slate-300 mt-0.5">{latestRating.log_date}</p>
            {cfGoal > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>목표 달성률</span>
                  <span>{Math.min(100, Math.round((latestRating.rating / cfGoal) * 100))}%</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((latestRating.rating / cfGoal) * 100))}%`,
                      backgroundColor: ratingColor(cfGoal),
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {latestRating.rating} → {cfGoal} (
                  {cfGoal - latestRating.rating > 0 ? `+${cfGoal - latestRating.rating}` : '달성!'})
                </p>
              </div>
            )}
          </div>
          {maxRating != null && maxRatingRecord && maxRating !== latestRating.rating && (
            <div className="border border-slate-100 rounded-xl px-5 py-4">
              <p className="text-xs text-slate-400 mb-1.5">최고 레이팅</p>
              <p className="text-3xl font-semibold" style={{ color: ratingColor(maxRating) }}>
                {maxRating}
              </p>
              <p className="text-xs text-slate-400 mt-1 capitalize">{maxRatingRecord.rank_name}</p>
              <p className="text-[10px] text-slate-300 mt-0.5">{maxRatingRecord.log_date}</p>
            </div>
          )}
          {(maxRating == null || maxRating === latestRating.rating) && (
            <div className="border border-slate-100 rounded-xl px-5 py-4 flex flex-col justify-center">
              <p className="text-xs text-slate-400 mb-1">총 기록</p>
              <p className="text-2xl font-semibold text-slate-900">{ratings.length}회</p>
              {ratings.length > 1 &&
                (() => {
                  const first = ratings[ratings.length - 1];
                  const diff = latestRating.rating - first.rating;
                  return (
                    <p
                      className={`text-xs mt-1 font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      첫 기록 대비 {diff >= 0 ? '+' : ''}
                      {diff}
                    </p>
                  );
                })()}
            </div>
          )}
        </div>
      )}

      {/* 성장 통계 + 하락 경고 */}
      {latestRating && (growthStats || recentDecline) && (
        <div className="flex flex-wrap gap-3">
          {growthStats && (
            <div className="flex-1 border border-slate-100 rounded-xl px-4 py-3 min-w-0">
              <p className="text-xs text-slate-400 mb-1">성장 속도</p>
              <p
                className={`text-lg font-semibold ${growthStats.totalGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {growthStats.totalGrowth >= 0 ? '+' : ''}
                {growthStats.totalGrowth}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {growthStats.days}일간 · 월평균 {growthStats.monthlyGrowth >= 0 ? '+' : ''}
                {growthStats.monthlyGrowth}
              </p>
            </div>
          )}
          {recentDecline && (
            <div className="flex-1 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 min-w-0">
              <p className="text-xs text-amber-600 font-medium mb-1">⚠️ 3회 연속 하락</p>
              <p className="text-[11px] text-amber-700">
                {ratings[2].rating} → {ratings[1].rating} → {ratings[0].rating}
              </p>
              <p className="text-[10px] text-amber-500 mt-0.5">최근 기록 기준</p>
            </div>
          )}
        </div>
      )}

      {chartData.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              레이팅 추이
            </p>
            {ratingYears.length > 1 && (
              <div className="flex gap-1">
                {(['all', ...ratingYears] as const).map((y) => (
                  <button
                    key={y}
                    onClick={() => setChartYear(y)}
                    className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${chartYear === y ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {y === 'all' ? '전체' : y}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(() => {
            const allRatings = chartData.map((d) => d.rating);
            const minR = Math.min(...allRatings);
            const maxR = Math.max(...allRatings);
            const thresholds = [
              { y: 1200, label: 'Pupil', color: '#008000' },
              { y: 1600, label: 'Specialist', color: '#03a89e' },
              { y: 1900, label: 'Expert', color: '#0000ff' },
              { y: 2100, label: 'Cand.Master', color: '#aa00aa' },
              { y: 2400, label: 'Master', color: '#ff8c00' },
            ].filter((t) => t.y > minR - 200 && t.y < maxR + 400);
            return (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis
                    domain={['dataMin - 100', 'dataMax + 200']}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    formatter={(v, _, props) => [`${v} (${props.payload?.rank ?? ''})`, '레이팅']}
                  />
                  {thresholds.map((t) => (
                    <ReferenceLine
                      key={t.y}
                      y={t.y}
                      stroke={t.color}
                      strokeDasharray="4 2"
                      strokeOpacity={0.5}
                      label={{
                        value: t.label,
                        position: 'insideTopRight',
                        fontSize: 9,
                        fill: t.color,
                        fillOpacity: 0.8,
                      }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={payload.date}
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={ratingColor(payload.rating)}
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                      );
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      )}

      {/* 프로필 설정 */}
      <div className="border border-slate-100 rounded-xl p-5">
        <p className="text-sm font-medium text-slate-800 mb-4">프로필 설정</p>
        <form onSubmit={saveSettings} className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Codeforces 핸들</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.cf_handle ?? ''}
                onChange={(e) => setSettings({ ...settings, cf_handle: e.target.value || null })}
                placeholder="예: tourist"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {settings.cf_handle && /^[\w\-]{1,24}$/.test(settings.cf_handle) && (
                <a
                  href={`https://codeforces.com/profile/${settings.cf_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">GitHub 사용자명</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm shrink-0">github.com/</span>
              <input
                type="text"
                value={settings.github_username ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, github_username: e.target.value || null })
                }
                placeholder="username"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {settings.github_username &&
                /^[a-zA-Z0-9](?:[a-zA-Z0-9_\-]{0,37}[a-zA-Z0-9])?$/.test(
                  settings.github_username,
                ) && (
                  <a
                    href={`https://github.com/${settings.github_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">블로그 URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.blog_url ?? ''}
                onChange={(e) => setSettings({ ...settings, blog_url: e.target.value || null })}
                placeholder="https://..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {settings.blog_url && /^https?:\/\//i.test(settings.blog_url) && (
                <a
                  href={settings.blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={mutating.has('settings_save')}
              className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutating.has('settings_save') && <Loader2 size={13} className="animate-spin" />}
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
            <button
              onClick={() => handleExport('career', exportApi.career)}
              disabled={exporting.has('career')}
              title="CSV 내보내기"
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting.has('career') ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>
            <button
              onClick={() => setShowRatingForm(!showRatingForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              + 추가
            </button>
          </div>
        </div>
        {showRatingForm && (
          <form onSubmit={submitRating} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">날짜</label>
                <input
                  type="date"
                  value={ratingForm.log_date}
                  onChange={(e) => setRatingForm({ ...ratingForm, log_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">레이팅</label>
                <input
                  type="number"
                  min="0"
                  max="4000"
                  value={ratingForm.rating}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = parseInt(v, 10);
                    setRatingForm({
                      ...ratingForm,
                      rating: v,
                      rank_name: isNaN(n) ? ratingForm.rank_name : inferRank(n),
                    });
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">랭크 (자동)</label>
                <select
                  value={ratingForm.rank_name}
                  onChange={(e) => setRatingForm({ ...ratingForm, rank_name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {cfRanks.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShowRatingForm(false)}
                disabled={mutating.has('rating_create')}
                className="text-sm text-slate-500 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={mutating.has('rating_create')}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutating.has('rating_create') && <Loader2 size={12} className="animate-spin" />}
                저장
              </button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-100">
          {ratings.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">레이팅 기록이 없어요</p>
              <button
                onClick={() => setShowRatingForm(true)}
                className="mt-2 text-xs text-slate-500 underline underline-offset-2"
              >
                첫 레이팅 기록하기
              </button>
            </div>
          ) : (
            ratings.map((r, i) => {
              const prev = ratings[i + 1];
              const diff = prev ? r.rating - prev.rating : null;
              return editingRating?.id === r.id ? (
                <div key={r.id} className="px-5 py-3 bg-blue-50 border-l-2 border-blue-400">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input
                      type="date"
                      value={editingRating.log_date}
                      onChange={(e) =>
                        setEditingRating({ ...editingRating, log_date: e.target.value })
                      }
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <input
                      type="number"
                      min="0"
                      max="4000"
                      value={editingRating.rating}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = parseInt(v, 10);
                        setEditingRating({
                          ...editingRating,
                          rating: v,
                          rank_name: isNaN(n) ? editingRating.rank_name : inferRank(n),
                        });
                      }}
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <select
                      value={editingRating.rank_name}
                      onChange={(e) =>
                        setEditingRating({ ...editingRating, rank_name: e.target.value })
                      }
                      className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    >
                      {cfRanks.map((rank) => (
                        <option key={rank} value={rank}>
                          {rank}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={updateRating}
                      disabled={mutating.has(`rating_update_${editingRating.id}`)}
                      className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {mutating.has(`rating_update_${editingRating.id}`) && (
                        <Loader2 size={10} className="animate-spin" />
                      )}
                      저장
                    </button>
                    <button
                      onClick={() => setEditingRating(null)}
                      disabled={mutating.has(`rating_update_${editingRating.id}`)}
                      className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={r.id}
                  className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                  onClick={() => {
                    if (deletingId !== r.id)
                      setEditingRating({
                        id: r.id,
                        log_date: String(r.log_date),
                        rating: String(r.rating),
                        rank_name: r.rank_name,
                      });
                  }}
                >
                  <span className="text-slate-400 text-xs w-24 shrink-0">{r.log_date}</span>
                  <span
                    className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors"
                    style={{ color: ratingColor(r.rating) }}
                  >
                    {r.rating}
                  </span>
                  <span className="text-slate-500 text-xs capitalize hidden sm:block">
                    {r.rank_name}
                  </span>
                  {diff !== null && (
                    <span
                      className={`text-xs font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                  {deletingId === r.id ? (
                    <DeleteConfirm
                      onConfirm={() => deleteRating(r.id)}
                      onCancel={() => setDeletingId(null)}
                      disabled={mutating.has(`rating_delete_${r.id}`)}
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(r.id);
                      }}
                      className="ml-auto text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          {hasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button
                onClick={handleLoadMore}
                disabled={loadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                {loadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
