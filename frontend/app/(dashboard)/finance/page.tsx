'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { financeApi } from '@/lib/api';
import type { AssetRecordResponse } from '@/types';

export default function FinancePage() {
  const [records, setRecords] = useState<AssetRecordResponse[]>([]);
  const [summary, setSummary] = useState<{ latest_total_assets: number | null; avg_savings_rate: number | null }>({ latest_total_assets: null, avg_savings_rate: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ record_date: '', total_assets: '', monthly_income: '', monthly_expense: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await financeApi.getSummary();
      setRecords(data.records);
      setSummary({ latest_total_assets: data.latest_total_assets, avg_savings_rate: data.avg_savings_rate });
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setForm(f => ({ ...f, record_date: new Date().toISOString().slice(0, 10) }));
    load();
  }, []);

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
      await load();
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await financeApi.deleteRecord(id);
      await load();
    } catch {
      setError('삭제에 실패했습니다.');
    }
  }

  const chartData = [...records].reverse().map(r => ({
    date: r.record_date.slice(5),
    자산: r.total_assets,
  }));

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">재테크</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-slate-900 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          + 기록 추가
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between border border-red-100 bg-red-50 rounded-lg px-4 py-2.5 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 text-xs">✕</button>
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">총 자산 (최신)</p>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.latest_total_assets != null ? `${summary.latest_total_assets.toLocaleString()}만원` : '—'}
          </p>
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">평균 저축률 (최근 3개월)</p>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.avg_savings_rate != null ? `${summary.avg_savings_rate}%` : '—'}
          </p>
        </div>
      </div>

      {/* 차트 */}
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

      {/* 추가 폼 */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-medium text-slate-800 mb-4">새 기록</p>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
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
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">메모</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['날짜', '총 자산', '수입', '지출', '저축액', '저축률', '메모', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {records.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-slate-400 text-sm py-10">기록이 없습니다</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-500 text-xs">{r.record_date}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{r.total_assets.toLocaleString()}만</td>
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
                <td className="px-4 py-3 text-slate-400 text-xs">{r.note ?? '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-red-400 text-xs transition-colors">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
