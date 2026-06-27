'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';
import { financeApi, exportApi } from '@/lib/api';
import type { AssetRecordResponse } from '@/types';
import { Trash2, Download, TrendingUp, TrendingDown, Target } from 'lucide-react';

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <button onClick={onConfirm} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">확인</button>
      <button onClick={onCancel} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors">취소</button>
    </span>
  );
}

const PAGE = 20;
const GOAL_KEY = 'asset_goal';
const BUDGET_KEY = 'monthly_expense_budget';
const SAVINGS_RATE_GOAL_KEY = 'savings_rate_goal';

export default function FinancePage() {
  const [records, setRecords] = useState<AssetRecordResponse[]>([]);
  const [summary, setSummary] = useState<{ latest_total_assets: number | null; avg_savings_rate: number | null; asset_change: number | null }>({ latest_total_assets: null, avg_savings_rate: null, asset_change: null });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ record_date: '', total_assets: '', monthly_income: '', monthly_expense: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ total_assets: '', monthly_income: '', monthly_expense: '', note: '' });
  const [assetGoal, setAssetGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(GOAL_KEY) ?? '0', 10) || 0;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(BUDGET_KEY) ?? '0', 10) || 0;
  });
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingsRateGoal, setSavingsRateGoal] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(SAVINGS_RATE_GOAL_KEY) ?? '0', 10) || 0;
  });
  const [editingSrGoal, setEditingSrGoal] = useState(false);
  const [srGoalInput, setSrGoalInput] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [noteSearch, setNoteSearch] = useState('');

  async function load() {
    try {
      const data = await financeApi.getSummary(100);
      setRecords(data.records);
      setHasMore(data.records.length === 100);
      setSummary({ latest_total_assets: data.latest_total_assets, avg_savings_rate: data.avg_savings_rate, asset_change: data.asset_change });
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    setLoadMore(true);
    try {
      const more = await financeApi.listRecords(PAGE, records.length);
      setRecords(prev => [...prev, ...more]);
      setHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setLoadMore(false); }
  }

  useEffect(() => {
    setForm(f => ({ ...f, record_date: new Date().toISOString().slice(0, 10) }));
    load();
  }, []);

  useAiRefresh(['finance'], load);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await financeApi.createRecord({
        record_date: form.record_date,
        total_assets: Number(form.total_assets),
        monthly_income: Number(form.monthly_income),
        monthly_expense: Number(form.monthly_expense),
        note: form.note || undefined,
      });
      setForm(f => ({ ...f, total_assets: '', monthly_income: '', monthly_expense: '', note: '' }));
      setShowForm(false);
      showToast('재테크 기록 저장됨');
      await load();
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(r: AssetRecordResponse) {
    setEditingId(r.id);
    setEditForm({ total_assets: String(r.total_assets), monthly_income: String(r.monthly_income), monthly_expense: String(r.monthly_expense), note: r.note ?? '' });
  }

  async function handleUpdate() {
    if (!editingId) return;
    try {
      await financeApi.updateRecord(editingId, {
        total_assets: Number(editForm.total_assets),
        monthly_income: Number(editForm.monthly_income),
        monthly_expense: Number(editForm.monthly_expense),
        note: editForm.note || null,
      });
      setEditingId(null);
      showToast('기록 수정됨');
      await load();
    } catch {
      showToast('수정에 실패했습니다.', 'error');
    }
  }

  async function handleDelete(id: number) {
    try {
      await financeApi.deleteRecord(id);
      setDeletingId(null);
      showToast('기록 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  function saveGoal() {
    const v = parseInt(goalInput.replace(/,/g, ''), 10);
    if (v > 0) { localStorage.setItem(GOAL_KEY, String(v)); setAssetGoal(v); }
    setEditingGoal(false);
  }

  function saveBudget() {
    const v = parseInt(budgetInput.replace(/,/g, ''), 10);
    if (v > 0) { localStorage.setItem(BUDGET_KEY, String(v)); setMonthlyBudget(v); }
    setEditingBudget(false);
  }

  function saveSrGoal() {
    const v = parseInt(srGoalInput, 10);
    if (v > 0 && v <= 100) { localStorage.setItem(SAVINGS_RATE_GOAL_KEY, String(v)); setSavingsRateGoal(v); }
    setEditingSrGoal(false);
  }

  // 연도 목록 (내림차순)
  const years = [...new Set(records.map(r => r.record_date.slice(0, 4)))].sort().reverse();

  // 연도 필터 + 메모 검색 적용 (테이블용: 최신순, 차트용: 시간순)
  const filteredForTable = records.filter(r => {
    const yearOk = yearFilter === 'all' || r.record_date.startsWith(yearFilter);
    const q = noteSearch.trim().toLowerCase();
    const noteOk = !q || (r.note ?? '').toLowerCase().includes(q);
    return yearOk && noteOk;
  });
  const sorted = [...filteredForTable].reverse();

  const chartData = sorted.map(r => ({
    date: r.record_date.slice(5),
    자산: r.total_assets,
    저축률: r.savings_rate ?? null,
  }));

  // 전달 대비 자산 변화량
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const assetDelta = latest && prev ? latest.total_assets - prev.total_assets : null;

  // 월별 수입/지출 바 차트 (최근 6개)
  const incomeExpenseData = sorted.slice(-6).map(r => ({
    date: r.record_date.slice(0, 7),
    수입: r.monthly_income,
    지출: r.monthly_expense,
    저축: r.savings_amount,
  }));

  // 저축률 평균 (차트용 기준선)
  const ratesWithValue = sorted.filter(r => r.savings_rate != null);
  const avgRate = ratesWithValue.length > 0
    ? ratesWithValue.reduce((s, r) => s + (r.savings_rate ?? 0), 0) / ratesWithValue.length
    : null;

  // 자산 목표 달성 예상 기간 (최근 6개월 평균 저축액 기준)
  const avgMonthlySavingsAmt = (() => {
    const recent = sorted.slice(-6).filter(r => r.savings_amount > 0);
    if (recent.length === 0) return null;
    return Math.round(recent.reduce((s, r) => s + r.savings_amount, 0) / recent.length);
  })();
  const goalRemaining = assetGoal > 0 && latest ? assetGoal - latest.total_assets : null;
  const monthsToGoal = goalRemaining != null && goalRemaining > 0 && avgMonthlySavingsAmt && avgMonthlySavingsAmt > 0
    ? Math.ceil(goalRemaining / avgMonthlySavingsAmt) : null;
  const goalAchieved = goalRemaining != null && goalRemaining <= 0;

  // 3개월 연속 저축률 하락 감지
  const savingsDeclineAlert = (() => {
    const recent = ratesWithValue.slice(-3);
    if (recent.length < 3) return false;
    return (recent[1].savings_rate ?? 0) < (recent[0].savings_rate ?? 0) &&
           (recent[2].savings_rate ?? 0) < (recent[1].savings_rate ?? 0);
  })();

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {savingsDeclineAlert && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <TrendingDown size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>최근 3개월 저축률이 연속 하락하고 있어요. 지출 패턴을 점검해보세요.</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">재테크</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportApi.finance()}
            title="CSV 내보내기"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            + 기록 추가
          </button>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">총 자산 (최신)</p>
            {!editingGoal ? (
              <button onClick={() => { setGoalInput(assetGoal > 0 ? String(assetGoal) : ''); setEditingGoal(true); }}
                className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                <Target size={10} />
                {assetGoal > 0 ? `목표 ${assetGoal.toLocaleString()}만` : '목표 설정'}
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <input type="number" min="1" value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                  autoFocus
                  placeholder="만원"
                  className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" />
                <button onClick={saveGoal} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">확인</button>
              </div>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.latest_total_assets != null ? `${summary.latest_total_assets.toLocaleString()}만원` : '—'}
          </p>
          {assetDelta != null && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${assetDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {assetDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{assetDelta >= 0 ? '+' : ''}{assetDelta.toLocaleString()}만원 (전회 대비)</span>
            </div>
          )}
          {assetGoal > 0 && summary.latest_total_assets != null && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>목표 달성률</span>
                <span>{Math.min(100, Math.round((summary.latest_total_assets / assetGoal) * 100))}%</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((summary.latest_total_assets / assetGoal) * 100))}%` }} />
              </div>
              {goalAchieved ? (
                <p className="text-[10px] text-emerald-600 font-medium mt-1">🎉 목표 달성!</p>
              ) : monthsToGoal != null ? (
                <p className="text-[10px] text-slate-400 mt-1">
                  현재 속도로 약{' '}
                  {monthsToGoal >= 12
                    ? `${Math.floor(monthsToGoal / 12)}년${monthsToGoal % 12 > 0 ? ` ${monthsToGoal % 12}개월` : ''}`
                    : `${monthsToGoal}개월`}{' '}
                  후 달성 예상
                </p>
              ) : null}
            </div>
          )}
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-slate-400">평균 저축률 (3개월)</p>
            {editingBudget ? (
              <div className="flex items-center gap-1">
                <input type="number" min="1" value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') setEditingBudget(false); }}
                  autoFocus placeholder="만원"
                  className="w-20 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" />
                <button onClick={saveBudget} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">확인</button>
              </div>
            ) : (
              <button onClick={() => { setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : ''); setEditingBudget(true); }}
                className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                <Target size={10} />
                {monthlyBudget > 0 ? `예산 ${monthlyBudget.toLocaleString()}만` : '지출 예산'}
              </button>
            )}
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.avg_savings_rate != null ? `${summary.avg_savings_rate}%` : '—'}
          </p>
          {summary.avg_savings_rate != null && (
            <p className="text-xs mt-1 text-slate-400">
              {summary.avg_savings_rate >= 30 ? '우수한 저축률' : summary.avg_savings_rate >= 15 ? '양호한 저축률' : '저축률을 높여보세요'}
            </p>
          )}
          {savingsRateGoal > 0 && summary.avg_savings_rate != null && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>목표 {savingsRateGoal}%</span>
                <span className={summary.avg_savings_rate >= savingsRateGoal ? 'text-emerald-600 font-medium' : ''}>
                  {summary.avg_savings_rate >= savingsRateGoal ? '🎉 달성!' : `${summary.avg_savings_rate} / ${savingsRateGoal}%`}
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${summary.avg_savings_rate >= savingsRateGoal ? 'bg-emerald-400' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(100, Math.round((summary.avg_savings_rate / savingsRateGoal) * 100))}%` }} />
              </div>
            </div>
          )}
          {!savingsRateGoal && (
            <div className="mt-2">
              {editingSrGoal ? (
                <div className="flex items-center gap-1">
                  <input type="number" min="1" max="100" value={srGoalInput}
                    onChange={e => setSrGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveSrGoal(); if (e.key === 'Escape') setEditingSrGoal(false); }}
                    autoFocus placeholder="%"
                    className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" />
                  <button onClick={saveSrGoal} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">확인</button>
                  <button onClick={() => setEditingSrGoal(false)} className="text-[10px] text-slate-400 hover:text-slate-600">취소</button>
                </div>
              ) : (
                <button onClick={() => { setSrGoalInput(''); setEditingSrGoal(true); }}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                  <Target size={10} />
                  저축률 목표 설정
                </button>
              )}
            </div>
          )}
          {savingsRateGoal > 0 && !editingSrGoal && (
            editingSrGoal ? null : (
              <button onClick={() => { setSrGoalInput(String(savingsRateGoal)); setEditingSrGoal(true); }}
                className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors mt-1 block">
                목표 변경
              </button>
            )
          )}
          {editingSrGoal && savingsRateGoal > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <input type="number" min="1" max="100" value={srGoalInput}
                onChange={e => setSrGoalInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveSrGoal(); if (e.key === 'Escape') setEditingSrGoal(false); }}
                autoFocus placeholder="%"
                className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" />
              <button onClick={saveSrGoal} className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600">확인</button>
              <button onClick={() => setEditingSrGoal(false)} className="text-[10px] text-slate-400 hover:text-slate-600">취소</button>
            </div>
          )}
          {monthlyBudget > 0 && latest?.monthly_expense != null && (
            <div className="mt-2 pt-2 border-t border-slate-50">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>이번 달 지출</span>
                <span className={latest.monthly_expense > monthlyBudget ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}>
                  {latest.monthly_expense.toLocaleString()} / {monthlyBudget.toLocaleString()}만
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${latest.monthly_expense > monthlyBudget ? 'bg-red-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, Math.round((latest.monthly_expense / monthlyBudget) * 100))}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 자산 추이 차트 */}
      {chartData.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">자산 추이 (만원)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `${(v as number).toLocaleString()}`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={65} />
              <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}만원`, '자산']} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="자산" stroke="#0f172a" strokeWidth={1.5} dot={{ r: 2.5, fill: '#0f172a' }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 월별 수입/지출/저축 차트 */}
      {incomeExpenseData.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">월별 수입 · 지출 · 저축 (만원)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={incomeExpenseData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `${(v as number).toLocaleString()}`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={55} />
              <Tooltip formatter={(v, name) => [`${(v as number).toLocaleString()}만원`, name as string]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="수입" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="지출" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
              <Bar dataKey="저축" fill="#0f172a" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 저축률 추이 차트 */}
      {ratesWithValue.length >= 2 && (
        <div className="border border-slate-100 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500 mb-4 uppercase tracking-wide">저축률 추이 (%)</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 'auto']} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} />
              <Tooltip formatter={(v) => [`${v}%`, '저축률']} contentStyle={{ fontSize: 12 }} />
              {avgRate != null && (
                <ReferenceLine y={avgRate} stroke="#94a3b8" strokeDasharray="4 4"
                  label={{ value: `평균 ${Math.round(avgRate)}%`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />
              )}
              <Line
                type="monotone" dataKey="저축률" stroke="#3b82f6" strokeWidth={1.5}
                dot={{ r: 2.5, fill: '#3b82f6' }} activeDot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-800 mb-4">새 기록</p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: '날짜', key: 'record_date', type: 'date' },
              { label: '총 자산 (만원)', key: 'total_assets', type: 'number' },
              { label: '월 수입 (만원)', key: 'monthly_income', type: 'number' },
              { label: '월 지출 (만원)', key: 'monthly_expense', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required={key !== 'note'}
                  min={type === 'number' ? '0' : undefined}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">메모</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" disabled={submitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 기록 테이블 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {(years.length > 1 || records.length > 5) && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-slate-50 bg-slate-50/50">
            {years.length > 1 && (['all', ...years] as const).map(y => (
              <button key={y} onClick={() => setYearFilter(y)}
                className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${yearFilter === y ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {y === 'all' ? '전체' : `${y}년`}
              </button>
            ))}
            {records.length > 5 && (
              <input type="text" value={noteSearch} onChange={e => setNoteSearch(e.target.value)}
                placeholder="메모 검색..."
                className="ml-auto text-xs border border-slate-200 rounded-lg px-2.5 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white" />
            )}
          </div>
        )}
        {records.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm">아직 재테크 기록이 없어요</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
          </div>
        ) : filteredForTable.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm">검색 결과가 없어요</p>
            <button onClick={() => { setYearFilter('all'); setNoteSearch(''); }} className="mt-2 text-xs text-slate-500 underline underline-offset-2">필터 초기화</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['날짜', '총 자산', '수입', '지출', '저축액', '저축률', '메모', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredForTable.map((r, idx) => {
                  const prevRecord = filteredForTable[idx + 1];
                  const delta = prevRecord ? r.total_assets - prevRecord.total_assets : null;
                  if (editingId === r.id) {
                    const inCls = 'w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
                    return (
                      <tr key={r.id} className="bg-blue-50">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.record_date}</td>
                        <td className="px-2 py-2"><input type="number" value={editForm.total_assets} onChange={e => setEditForm({ ...editForm, total_assets: e.target.value })} className={inCls} /></td>
                        <td className="px-2 py-2"><input type="number" value={editForm.monthly_income} onChange={e => setEditForm({ ...editForm, monthly_income: e.target.value })} className={inCls} /></td>
                        <td className="px-2 py-2"><input type="number" value={editForm.monthly_expense} onChange={e => setEditForm({ ...editForm, monthly_expense: e.target.value })} className={inCls} /></td>
                        <td className="px-4 py-3 text-slate-400 text-xs">자동</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">자동</td>
                        <td className="px-2 py-2"><input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder="메모" className={inCls} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={handleUpdate} className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
                            <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600">취소</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { if (deletingId !== r.id) startEdit(r); }}>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.record_date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        <div>{r.total_assets.toLocaleString()}만</div>
                        {delta != null && (
                          <div className={`text-[10px] font-normal ${delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.monthly_income.toLocaleString()}만</td>
                      <td className="px-4 py-3 text-slate-500">{r.monthly_expense.toLocaleString()}만</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{r.savings_amount.toLocaleString()}만</td>
                      <td className="px-4 py-3">
                        {r.savings_rate != null ? (
                          <span className={`text-xs font-medium ${r.savings_rate >= 20 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {r.savings_rate}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[80px] truncate">{r.note ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {deletingId === r.id ? (
                          <DeleteConfirm onConfirm={() => handleDelete(r.id)} onCancel={() => setDeletingId(null)} />
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setDeletingId(r.id); }} className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={handleLoadMore} disabled={loadMore}
              className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
              {loadMore ? '불러오는 중...' : '더 보기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
