'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { financeApi, exportApi } from '@/lib/api';
import type { AssetRecordResponse } from '@/types';
import { Trash2, Download } from 'lucide-react';

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="flex items-center gap-1">
      <button onClick={onConfirm} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">확인</button>
      <button onClick={onCancel} className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-slate-600 transition-colors">취소</button>
    </span>
  );
}

const PAGE = 20;

export default function FinancePage() {
  const [records, setRecords] = useState<AssetRecordResponse[]>([]);
  const [summary, setSummary] = useState<{ latest_total_assets: number | null; avg_savings_rate: number | null }>({ latest_total_assets: null, avg_savings_rate: null });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadMore, setLoadMore] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ record_date: '', total_assets: '', monthly_income: '', monthly_expense: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    try {
      const data = await financeApi.getSummary(100);
      setRecords(data.records);
      setHasMore(data.records.length === 100);
      setSummary({ latest_total_assets: data.latest_total_assets, avg_savings_rate: data.avg_savings_rate });
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
        {records.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-400 text-sm">아직 재테크 기록이 없어요</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
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
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.record_date}</td>
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
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[80px] truncate">{r.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {deletingId === r.id ? (
                        <DeleteConfirm onConfirm={() => handleDelete(r.id)} onCancel={() => setDeletingId(null)} />
                      ) : (
                        <button onClick={() => setDeletingId(r.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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
