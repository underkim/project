'use client';

import { useEffect, useState } from 'react';
import { devstatusApi } from '@/lib/api';
import type { DevStatusOverview, TaskSummary } from '@/types';
import {
  GitBranch, GitCommit, ShieldCheck, Sparkles, RefreshCw, AlertCircle, PowerOff,
} from 'lucide-react';

const STATUS_ORDER = ['draft', 'approved', 'working', 'blocked', 'implemented', 'reviewed', 'done'] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: '초안', approved: '승인됨', working: '진행 중', blocked: '막힘',
  implemented: '구현됨', reviewed: '검토됨', done: '완료',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  approved: 'bg-blue-50 text-blue-600',
  working: 'bg-amber-50 text-amber-600',
  blocked: 'bg-red-50 text-red-600',
  implemented: 'bg-violet-50 text-violet-600',
  reviewed: 'bg-emerald-50 text-emerald-600',
  done: 'bg-slate-100 text-slate-400',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function TaskRow({ task }: { task: TaskSummary }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 truncate">
          <span className="text-slate-400 font-mono text-xs mr-1.5">{task.id}</span>
          {task.title}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.priority && (
          <span className="text-[10px] text-slate-400">{task.priority}</span>
        )}
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}

export default function DevStatusPage() {
  const [data, setData] = useState<DevStatusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    setDisabled(false);
    try {
      const overview = await devstatusApi.getOverview();
      setData(overview);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setDisabled(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
    </div>
  );

  if (disabled) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <PowerOff size={22} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-600">개발 현황 모듈이 비활성화되어 있어요</p>
      <p className="text-xs text-slate-400 max-w-sm">
        백엔드 환경변수 <code className="bg-slate-100 px-1 py-0.5 rounded">ENABLE_DEVSTATUS_MODULE=true</code>로
        설정하면 다시 활성화됩니다.
      </p>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlertCircle size={22} className="text-amber-400" />
      <p className="text-sm text-slate-600">데이터를 불러오지 못했습니다.</p>
      <button
        onClick={load}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-xl hover:bg-slate-700 transition-colors"
      >
        <RefreshCw size={14} />
        다시 시도
      </button>
    </div>
  );

  const totalUnfinished = data.task_counts.draft + data.task_counts.approved + data.task_counts.working;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">개발 현황</h1>
          <p className="text-xs text-slate-400 mt-0.5">Claude Code 엔지니어링 상태 &amp; 태스크 진행 상황</p>
        </div>
        <button onClick={load} className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* 태스크 상태 요약 */}
      <div className="border border-slate-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">태스크 현황</p>
          <span className="text-xs text-slate-400">진행 대기 {totalUnfinished}개</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {STATUS_ORDER.map(s => (
            <div key={s} className="text-center rounded-lg bg-slate-50 px-2 py-3">
              <p className="text-lg font-semibold text-slate-900">{data.task_counts[s]}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{STATUS_LABEL[s]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 진행 중인 태스크 목록 */}
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">활성 태스크 ({data.active_tasks.length})</p>
        </div>
        {data.active_tasks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">활성 태스크가 없습니다</p>
        ) : (
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {data.active_tasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 하네스 상태 */}
        <div className="border border-slate-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-slate-400" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">하네스 (Claude Code 엔지니어링)</p>
          </div>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>권한 allowlist</span>
              <span className="font-medium text-slate-700">{data.harness.permission_rule_count}개</span>
            </div>
            <div className="flex justify-between">
              <span>.claudeignore</span>
              <span className={`font-medium ${data.harness.claudeignore_present ? 'text-emerald-600' : 'text-red-500'}`}>
                {data.harness.claudeignore_present ? '적용됨' : '없음'}
              </span>
            </div>
            {data.harness.hooks.length > 0 && (
              <div className="pt-2 border-t border-slate-50">
                <p className="text-slate-400 mb-1">Hooks</p>
                {data.harness.hooks.map(h => (
                  <div key={h.file} className="flex justify-between py-0.5">
                    <span className="font-mono text-slate-600">{h.file}</span>
                    <span className="text-slate-400">{h.events.join(', ')}</span>
                  </div>
                ))}
              </div>
            )}
            {data.harness.skills.length > 0 && (
              <div className="pt-2 border-t border-slate-50">
                <p className="text-slate-400 mb-1">Skills</p>
                {data.harness.skills.map(s => (
                  <div key={s.name} className="py-0.5">
                    <span className="font-mono text-slate-600">{s.name}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{s.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Git & 최근 작업 */}
        <div className="border border-slate-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={14} className="text-slate-400" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Git 상태</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">브랜치</span>
              <span className="font-medium text-slate-700">{data.git.branch ?? '—'}</span>
            </div>
            {data.git.last_commit_hash && (
              <div className="flex items-start gap-1.5 pt-1">
                <GitCommit size={12} className="text-slate-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-slate-700 truncate">{data.git.last_commit_message}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{data.git.last_commit_hash}</p>
                </div>
              </div>
            )}
          </div>

          {data.recent_dev_log.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-50">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-slate-300" />
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">최근 작업 기록</p>
              </div>
              <div className="space-y-1.5">
                {data.recent_dev_log.map(entry => (
                  <div key={entry.date} className="text-xs">
                    <span className="text-slate-400 font-mono mr-1.5">{entry.date}</span>
                    <span className="text-slate-600">{entry.summary || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 최근 완료 태스크 */}
      {data.recent_done.length > 0 && (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">최근 완료 태스크</p>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recent_done.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}
