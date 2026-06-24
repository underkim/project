'use client';

import { useEffect, useState } from 'react';
import { useAiRefresh } from '@/hooks/useAiRefresh';
import { showToast } from '@/lib/toast';
import { growthApi, exportApi } from '@/lib/api';
import type { BookRecordResponse, EnglishLogResponse, GrowthSummaryResponse, BookStatus } from '@/types';
import { Trash2, Download } from 'lucide-react';

const statusConfig: Record<BookStatus, { label: string; color: string }> = {
  planned:   { label: '예정',   color: 'bg-slate-100 text-slate-600' },
  reading:   { label: '읽는 중', color: 'bg-slate-200 text-slate-700' },
  completed: { label: '완독',   color: 'bg-slate-900 text-white' },
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

export default function GrowthPage() {
  const [summary, setSummary] = useState<GrowthSummaryResponse | null>(null);
  const [books, setBooks] = useState<BookRecordResponse[]>([]);
  const [englishLogs, setEnglishLogs] = useState<EnglishLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [booksHasMore, setBooksHasMore] = useState(false);
  const [engHasMore, setEngHasMore] = useState(false);
  const [booksLoadMore, setBooksLoadMore] = useState(false);
  const [engLoadMore, setEngLoadMore] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showEngForm, setShowEngForm] = useState(false);
  const [deletingBook, setDeletingBook] = useState<number | null>(null);
  const [deletingEng, setDeletingEng] = useState<number | null>(null);

  const [bookForm, setBookForm] = useState({ title: '', author: '', status: 'planned' as BookStatus });
  const [engForm, setEngForm] = useState({ log_date: '', activity_type: 'reading', duration_minutes: '', note: '' });

  async function load() {
    try {
      const [s, b, e] = await Promise.all([
        growthApi.getSummary(), growthApi.listBooks(PAGE), growthApi.listEnglish(PAGE),
      ]);
      setSummary(s);
      setBooks(b); setBooksHasMore(b.length === PAGE);
      setEnglishLogs(e); setEngHasMore(e.length === PAGE);
    } catch {
      showToast('데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreBooks() {
    setBooksLoadMore(true);
    try {
      const more = await growthApi.listBooks(PAGE, books.length);
      setBooks(prev => [...prev, ...more]);
      setBooksHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setBooksLoadMore(false); }
  }

  async function loadMoreEng() {
    setEngLoadMore(true);
    try {
      const more = await growthApi.listEnglish(PAGE, englishLogs.length);
      setEnglishLogs(prev => [...prev, ...more]);
      setEngHasMore(more.length === PAGE);
    } catch { showToast('불러오지 못했습니다.', 'error'); }
    finally { setEngLoadMore(false); }
  }

  useEffect(() => {
    setEngForm(f => ({ ...f, log_date: new Date().toISOString().slice(0, 10) }));
    load();
  }, []);

  useAiRefresh(['growth'], load);

  async function submitBook(e: React.FormEvent) {
    e.preventDefault();
    try {
      await growthApi.createBook({ ...bookForm, author: bookForm.author || undefined });
      setBookForm({ title: '', author: '', status: 'planned' });
      setShowBookForm(false);
      showToast('책 추가됨');
      await load();
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    }
  }

  async function updateBookStatus(id: number, status: BookStatus) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updates: Record<string, string | undefined> = { status };
      if (status === 'reading') updates.start_date = today;
      if (status === 'completed') updates.end_date = today;
      await growthApi.updateBook(id, updates);
      showToast(status === 'completed' ? '완독 달성! 🎉' : '상태 변경됨');
      await load();
    } catch {
      showToast('상태 변경에 실패했습니다.', 'error');
    }
  }

  async function deleteBook(id: number) {
    try {
      await growthApi.deleteBook(id);
      setDeletingBook(null);
      showToast('책 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
  }

  async function submitEng(e: React.FormEvent) {
    e.preventDefault();
    try {
      await growthApi.createEnglish({
        log_date: engForm.log_date, activity_type: engForm.activity_type,
        duration_minutes: Number(engForm.duration_minutes), note: engForm.note || undefined,
      });
      setEngForm(f => ({ ...f, duration_minutes: '', note: '' }));
      setShowEngForm(false);
      showToast('영어 학습 기록 저장됨');
      await load();
    } catch {
      showToast('저장에 실패했습니다.', 'error');
    }
  }

  async function deleteEnglish(id: number) {
    try {
      await growthApi.deleteEnglish(id);
      setDeletingEng(null);
      showToast('영어 기록 삭제됨');
      await load();
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
    }
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

      {/* 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">올해 완독</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.books_completed_this_year ?? 0}권</p>
          <p className="text-xs text-slate-400 mt-1">읽는 중 {summary?.books_reading ?? 0}권</p>
        </div>
        <div className="border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs text-slate-400 mb-1.5">이번 달 영어</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.english_days_this_month ?? 0}일</p>
          <p className="text-xs text-slate-400 mt-1">{summary?.english_minutes_this_month ?? 0}분</p>
        </div>
      </div>

      {/* 독서 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">독서 목록</p>
          <div className="flex items-center gap-2">
            <button onClick={() => exportApi.books()} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <Download size={14} />
            </button>
            <button onClick={() => setShowBookForm(!showBookForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
              + 추가
            </button>
          </div>
        </div>
        {showBookForm && (
          <form onSubmit={submitBook} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">제목</label>
                <input type="text" value={bookForm.title}
                  onChange={e => setBookForm({ ...bookForm, title: e.target.value })}
                  className={inputCls} required placeholder="책 제목" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">저자</label>
                <input type="text" value={bookForm.author}
                  onChange={e => setBookForm({ ...bookForm, author: e.target.value })}
                  className={inputCls} placeholder="저자명" />
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
          {books.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 등록된 책이 없어요</p>
              <button onClick={() => setShowBookForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 책 추가하기</button>
            </div>
          ) : books.map(book => (
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
              {deletingBook === book.id ? (
                <DeleteConfirm onConfirm={() => deleteBook(book.id)} onCancel={() => setDeletingBook(null)} />
              ) : (
                <button onClick={() => setDeletingBook(book.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {booksHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreBooks} disabled={booksLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {booksLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 영어 학습 섹션 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="text-sm font-medium text-slate-800">영어 학습 기록</p>
          <div className="flex items-center gap-2">
            <button onClick={() => exportApi.english()} title="CSV 내보내기" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <Download size={14} />
            </button>
            <button onClick={() => setShowEngForm(!showEngForm)}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors">
              + 추가
            </button>
          </div>
        </div>
        {showEngForm && (
          <form onSubmit={submitEng} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          {englishLogs.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-400 text-sm">아직 영어 학습 기록이 없어요</p>
              <button onClick={() => setShowEngForm(true)} className="mt-2 text-xs text-slate-500 underline underline-offset-2">첫 기록 추가하기</button>
            </div>
          ) : englishLogs.map(log => (
            <div key={log.id} className="flex items-center px-5 py-3 gap-4 hover:bg-slate-50 transition-colors">
              <span className="text-slate-400 text-xs w-24 shrink-0">{log.log_date}</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{log.activity_type}</span>
              <span className="text-sm text-slate-700">{log.duration_minutes}분</span>
              {log.note && <span className="text-slate-400 text-xs hidden sm:block truncate">{log.note}</span>}
              {deletingEng === log.id ? (
                <DeleteConfirm onConfirm={() => deleteEnglish(log.id)} onCancel={() => setDeletingEng(null)} />
              ) : (
                <button onClick={() => setDeletingEng(log.id)} className="ml-auto text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {engHasMore && (
            <div className="px-5 py-3 border-t border-slate-50">
              <button onClick={loadMoreEng} disabled={engLoadMore}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
                {engLoadMore ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
