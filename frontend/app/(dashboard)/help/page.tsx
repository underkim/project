'use client';

import {
  Bot, CalendarDays, TrendingUp, Activity, BookOpen, Briefcase,
  Plane, Lightbulb, MessageSquare, Trash2, PenLine, CheckSquare,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

// ─── 재사용 컴포넌트 ──────────────────────────────────────

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
    </div>
  );
}

function ExampleBubble({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 text-xs text-slate-600">
      <MessageSquare size={10} className="text-slate-400 shrink-0" />
      {text}
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-600">
      <ChevronRight size={13} className="text-slate-300 shrink-0 mt-0.5" />
      {text}
    </li>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left"
      >
        {title}
        <ChevronRight size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 bg-slate-50/50">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-3xl pb-12">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">가이드 & 매뉴얼</h1>
        <p className="text-slate-400 text-sm mt-1">Life Dashboard 주요 기능 사용법</p>
      </div>

      {/* ── AI 어시스턴트 ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={Bot} title="AI 어시스턴트" color="bg-slate-900" />
        <p className="text-sm text-slate-600 mb-4">
          우측 하단 <span className="font-semibold text-slate-800">AI 버튼</span>을 클릭하면 채팅창이 열립니다.
          자연어로 데이터를 기록·수정·삭제할 수 있고, 통계 질문도 가능합니다.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">기록 예시</p>
            <div className="flex flex-wrap gap-2">
              {[
                '오늘 러닝 45분 했어',
                '어제 수면 7.5시간, 품질 4점',
                '이번 달 저축 50만원',
                '파친코 읽기 시작했어',
                '영어 공부 오늘 30분',
                '코드포스 레이팅 1500 달성',
                '제주도 여행 다음 달 15일~18일',
              ].map(t => <ExampleBubble key={t} text={t} />)}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">수정 예시</p>
            <div className="flex flex-wrap gap-2">
              {[
                '오늘 운동 시간 60분으로 수정해줘',
                '어제 수면 품질 3점으로 바꿔줘',
                '파친코 총 페이지 820으로 수정',
              ].map(t => <ExampleBubble key={t} text={t} />)}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">삭제 예시</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                '오늘 운동 기록 지워줘',
                '제주도 여행 삭제해줘',
                '코드포스 레이팅 1500 기록 삭제',
              ].map(t => <ExampleBubble key={t} text={t} />)}
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <Trash2 size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">삭제 시 AI가 확인 버튼을 표시합니다. 확인을 눌러야 실제로 삭제됩니다.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">조회 예시</p>
            <div className="flex flex-wrap gap-2">
              {[
                '이번 주 운동 몇 번 했어?',
                '이번 달 저축률은?',
                '현재 읽고 있는 책은?',
                '이번 달 영어 공부 총 몇 분?',
                '내 자산 목표 진행 상황 알려줘',
              ].map(t => <ExampleBubble key={t} text={t} />)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
          <Lightbulb size={13} className="text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            채팅 이력은 브라우저에 저장됩니다. 상단 지우개 아이콘으로 초기화할 수 있습니다.
          </p>
        </div>
      </div>

      {/* ── 플래너 ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={CalendarDays} title="플래너" color="bg-indigo-500" />
        <p className="text-sm text-slate-600 mb-4">
          5년 로드맵을 Phase → Category → Item 계층으로 관리합니다.
        </p>
        <ul className="space-y-2 mb-4">
          <FeatureItem text="헤더의 시작일을 설정하면 각 Phase 기간이 자동 계산됩니다." />
          <FeatureItem text="Phase 탭의 ⚙️ 아이콘으로 이름·기간·색상을 편집할 수 있습니다." />
          <FeatureItem text="카테고리 카드의 ✏️ 아이콘으로 아이콘·제목·부제목을 편집합니다." />
          <FeatureItem text="항목 텍스트를 더블클릭하면 인라인 편집 모드가 됩니다." />
          <FeatureItem text="마감일 날짜를 클릭하면 날짜 피커로 변경할 수 있습니다." />
        </ul>

        <div className="space-y-2">
          <Accordion title="다중 선택 삭제 사용법">
            <div className="flex items-start gap-2">
              <CheckSquare size={13} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">카테고리 목록 우측 상단의 <strong>다중 선택</strong> 버튼을 클릭하면 선택 모드가 활성화됩니다.</p>
            </div>
            <p className="text-xs text-slate-600 pl-5">카드를 클릭해 선택(체크박스 표시) → <strong>선택 삭제</strong> 버튼 → 확인으로 일괄 삭제됩니다.</p>
            <p className="text-xs text-slate-500 pl-5">※ 카테고리 안의 모든 항목도 함께 삭제됩니다.</p>
          </Accordion>
          <Accordion title="마감일 상태 배지 기준">
            <div className="flex flex-wrap gap-2">
              {[
                { label: '완료', cls: 'bg-emerald-100 text-emerald-700' },
                { label: '진행중', cls: 'bg-blue-100 text-blue-700' },
                { label: '임박 (30일 이내)', cls: 'bg-amber-100 text-amber-700' },
                { label: '지연 (마감 초과)', cls: 'bg-red-100 text-red-600' },
              ].map(({ label, cls }) => (
                <span key={label} className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${cls}`}>{label}</span>
              ))}
            </div>
          </Accordion>
        </div>
      </div>

      {/* ── 재테크 ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={TrendingUp} title="재테크" color="bg-emerald-500" />
        <ul className="space-y-2">
          <FeatureItem text="자산 기록을 날짜별로 추가·수정·삭제할 수 있습니다." />
          <FeatureItem text="저축률 = (저축금액 / 소득) × 100. 입력 시 자동 계산됩니다." />
          <FeatureItem text="최근 3개월 평균 저축률과 최신 총자산을 요약에서 확인하세요." />
          <FeatureItem text="목표 금액·달성일·예상 연 수익률을 설정하면, 복리 효과를 반영한 필요 월 저축액을 계산해줍니다." />
          <FeatureItem text="CSV 내보내기로 전체 기록을 다운로드할 수 있습니다." />
        </ul>
      </div>

      {/* ── 건강 ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={Activity} title="건강" color="bg-rose-500" />
        <ul className="space-y-2">
          <FeatureItem text="운동: 날짜·종류·시간(분)·칼로리를 기록합니다." />
          <FeatureItem text="수면: 날짜·시간(h)·품질(1~5점)을 기록합니다." />
          <FeatureItem text="이번 주 운동 횟수·총 시간, 평균 수면 품질을 요약에서 확인하세요." />
          <FeatureItem text="CSV 내보내기 지원." />
        </ul>
      </div>

      {/* ── 자기계발 ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={BookOpen} title="자기계발" color="bg-violet-500" />
        <ul className="space-y-2">
          <FeatureItem text="독서: 제목·저자·시작일·완독일·총 페이지를 기록합니다." />
          <FeatureItem text="영어: 날짜·학습 시간·학습 유형을 기록합니다." />
          <FeatureItem text="올해 완독한 책 수, 현재 읽는 중인 책, 이번 달 영어 학습 시간을 요약에서 확인하세요." />
        </ul>
      </div>

      {/* ── 커리어 ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={Briefcase} title="커리어" color="bg-sky-500" />
        <ul className="space-y-2">
          <FeatureItem text="목표 레이팅과 현재 레이팅을 설정에서 관리합니다." />
          <FeatureItem text="Codeforces 대회 참가 후 레이팅을 날짜별로 기록합니다." />
          <FeatureItem text="레이팅 추이 차트와 최고·최저·평균 레이팅을 확인하세요." />
          <FeatureItem text="CSV 내보내기 지원." />
        </ul>
      </div>

      {/* ── 여행 ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={Plane} title="여행" color="bg-orange-500" />
        <ul className="space-y-2 mb-4">
          <FeatureItem text="여행 카드를 추가하고 목적지·날짜·상태·메모를 기록합니다." />
          <FeatureItem text="체크리스트 탭에서 짐 목록이나 준비 항목을 관리합니다." />
          <FeatureItem text="일정 탭에서 day별 세부 일정(시간·제목·설명)을 추가할 수 있습니다." />
        </ul>
        <div className="space-y-2">
          <Accordion title="여행 상태 종류">
            <div className="flex flex-wrap gap-2">
              {[
                { label: '예정', cls: 'bg-blue-100 text-blue-700' },
                { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
                { label: '완료', cls: 'bg-slate-100 text-slate-600' },
                { label: '취소', cls: 'bg-red-100 text-red-600' },
              ].map(({ label, cls }) => (
                <span key={label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${cls}`}>{label}</span>
              ))}
            </div>
          </Accordion>
        </div>
      </div>

      {/* ── 팁 모음 ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <SectionHeader icon={Lightbulb} title="주요 팁" color="bg-amber-400" />
        <ul className="space-y-2">
          <FeatureItem text="AI로 기록 후 해당 페이지가 자동으로 새로고침됩니다." />
          <FeatureItem text="홈 대시보드는 모든 모듈 요약을 한 번에 확인할 수 있습니다." />
          <FeatureItem text="AI 채팅에서 Enter 키로 전송, Shift+Enter로 줄바꿈합니다." />
          <FeatureItem text="각 표의 항목은 호버 시 나타나는 편집·삭제 버튼으로 관리합니다." />
          <FeatureItem text="Render 무료 티어 사용 중 — 첫 요청이 느릴 수 있습니다 (약 30~50초)." />
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <PenLine size={12} /> 인라인 편집
            </p>
            <p className="text-xs text-slate-500">항목 텍스트 더블클릭 → 수정 → Enter</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Trash2 size={12} /> 삭제 확인
            </p>
            <p className="text-xs text-slate-500">삭제 버튼 → 확인 버튼 (3초 타임아웃)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
