'use client';

import { useEffect, useState } from 'react';
import { growthApi } from '@/lib/api';
import type { BookRecordResponse, EnglishLogResponse, GrowthSummaryResponse, BookStatus } from '@/types';

const statusConfig: Record<BookStatus, { label: string; color: string }> = {
  planned:   { label: '예정',   color: 'bg-slate-100 text-slate-600' },
  reading:   { label: '읽는 중', color: 'bg-slate-200 text-slate-700' },
  completed: { label: '완독',   color: 'bg-slate-900 text-white' },
};

export default function GrowthPage() {
  const [summary, setSummary] = useState<GrowthSummaryResponse | null>(null);
  const [books, setBooks] = useState<BookRecordResponse[]>([]);
  const [englishLogs, setEnglishLogs] = useState<EnglishLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showEngForm, setShowEngForm] = useState(false);

  const [bookForm, setBookForm] = useState({ title: '', author: '', status: 'planned' as BookStatus, note: '' });
  const [engForm, setEngForm] = useState({ log_date: '', activity_type: 'reading', duration_minutes: '', note: '' });

  async function load() {
    setError(null);
    try {
      const [s, b, e] = await Promise.all([
        growthApi.getSummary(), growthApi.listBooks(), growthApi.listEnglish(),
      ]);
      setSummary(s); setBooks(b); setEnglishLogs(e);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setEngForm(f => ({ ...f, log_date: today }));
    load();
  }, []);

  async function submitBook(e: React.FormEvent) {
    e.preventDefault();
    try {
      await growthApi.createBook({ ...bookForm, author: bookForm.author || undefined });
      setBookForm({ title: '', author: '', status: 'planned', note: '' });
      setShowBookForm(false); await load();
    } catch {
      setError('책 저장에 실패했습니다.');
    }
  }

  async function updateBookStatus(id: number, status: BookStatus) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updates: Record<string, string | undefined> = { status };
      if (status === 'reading') updates.start_date = today;
      if (status === 'completed') updates.end_date = today;
      await growthApi.updateBook(id, updates);
      await load();
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  }

  async function deleteBook(id: number) {
    try { await growthApi.deleteBook(id); await load(); }
    catch { setError('삭제에 실패했습니다.'); }
  }

  async function submitEng(e: React.FormEvent) {
    e.preventDefault();
    try {
      await growthApi.createEnglish({
        log_date: engForm.log_date, activity_type: engForm.activity_type,
        duration_minutes: Number(engForm.duration_minutes), note: engForm.note || undefined,
      });
      setEngForm(f => ({ ...f, duration_minutes: '', note: '' }));
      setShowEngForm(false); await load();
    } catch {
      setError('영어 학습 저장에 실패했습니다.');
    }
  }

  async function deleteEnglish(id: number) {
    try { await growthApi.deleteEnglish(id); await load(); }
    catch { setError('삭제에 실패했습니다.'); }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white';

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">자기계발</h1>

      {error && (
        <div className="flex items-center justify-between border border-red-100 bg-red-50 rounded-lg px-4 py-2.5 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 text-xs">✕</button>
        </div>
      )}

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">올해 완독</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.books_completed_this_year ?? 0}권</p>
          <p className="text-xs text-slate-400 mt-1">읽는 중 {summary?.books_reading ?? 0}권</p>
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">이번 달 영어 학습</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.english_days_this_month ?? 0}일</p>
          <p className="text-xs text-slate-400 mt-1">{summary?.english_minutes_this_month ?? 0}분</p>
        </div>
      </div>

      {/* 독서 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">독서 목록</p>
          <button onClick={() => setShowBookForm(!showBookForm)}
            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
            + 추가
          </button>
        </div>
        {showBookForm && (
          <form onSubmit={submitBook} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">제목</label>
                <input type="text" value={bookForm.title}
                  onChange={e => setBookForm({ ...bookForm, title: e.target.value })}
                  className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">저자</label>
                <input type="text" value={bookForm.author}
                  onChange={e => setBookForm({ ...bookForm, author: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">상태</label>
                <select value={bookForm.status}
                  onChange={e => setBookForm({ ...bookForm, status: e.target.value as BookStatus })}
                  className={inputCls}>
                  <option value="planned">예정</option>
                  <option value="reading">읽는 중</option>
                  <option value="completed">완독</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowBookForm(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">저장</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {books.length === 0
            ? <p className="text-slate-400 text-sm text-center py-8">등록된 책이 없습니다</p>
            : books.map(book => (
              <div key={book.id} className="flex items-center px-5 py-3 gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-800 truncate">{book.title}</p>
                  {book.author && <p className="text-xs text-slate-400">{book.author}</p>}
                </div>
                <select
                  value={book.status}
                  onChange={e => updateBookStatus(book.id, e.target.value as BookStatus)}
                  className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${statusConfig[book.status].color}`}
                >
                  <option value="planned">예정</option>
                  <option value="reading">읽는 중</option>
                  <option value="completed">완독</option>
                </select>
                <button onClick={() => deleteBook(book.id)}
                  className="text-slate-300 hover:text-red-400 text-xs transition-colors">삭제</button>
              </div>
            ))}
        </div>
      </div>

      {/* 영어 학습 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">영어 학습 기록</p>
          <button onClick={() => setShowEngForm(!showEngForm)}
            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
            + 추가
          </button>
        </div>
        {showEngForm && (
          <form onSubmit={submitEng} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                <input type="date" value={engForm.log_date}
                  onChange={e => setEngForm({ ...engForm, log_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">유형</label>
                <select value={engForm.activity_type}
                  onChange={e => setEngForm({ ...engForm, activity_type: e.target.value })}
                  className={inputCls}>
                  <option value="reading">읽기</option>
                  <option value="listening">듣기</option>
                  <option value="speaking">말하기</option>
                  <option value="writing">쓰기</option>
                  <option value="vocab">단어</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">시간 (분)</label>
                <input type="number" min="1" value={engForm.duration_minutes}
                  onChange={e => setEngForm({ ...engForm, duration_minutes: e.target.value })}
                  className={inputCls} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowEngForm(false)} className="text-sm text-slate-500 hover:text-slate-700">취소</button>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700">저장</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {englishLogs.length === 0
            ? <p className="text-slate-400 text-sm text-center py-8">기록이 없습니다</p>
            : englishLogs.slice(0, 10).map(log => (
              <div key={log.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors">
                <span className="text-slate-400 text-xs w-24 shrink-0">{log.log_date}</span>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{log.activity_type}</span>
                <span className="text-sm text-slate-700">{log.duration_minutes}분</span>
                {log.note && <span className="text-slate-400 text-xs truncate">{log.note}</span>}
                <button onClick={() => deleteEnglish(log.id)}
                  className="ml-auto text-slate-300 hover:text-red-400 text-xs transition-colors">삭제</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
