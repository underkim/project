from __future__ import annotations

import asyncio
import json
import re
from datetime import date, timedelta

from google import genai
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings


_SYSTEM_PROMPT = """\
너는 라이프 대시보드 앱에 내장된 AI 어시스턴트야.
사용자의 5년 로드맵을 함께 관리하는 코치이자 대화 파트너야.

**대화 원칙:**
- 이전 대화 맥락을 기억하고 자연스럽게 연결해서 답변해
- 사용자가 이전에 언급한 내용(운동, 독서, 목표 등)을 참고하고 필요하면 직접 언급해
- 단순 기록 처리뿐 아니라 진심 어린 관심과 응원을 보여줘
- 질문에는 구체적으로 답하고, 현황 데이터를 수치로 인용해
- 짧고 친근한 말투 사용 (과도한 존댓말 금지)
- 데이터 처리 결과는 명확하게 알려줘

=== 날짜 기준 ===
오늘: {today} | 어제: {yesterday} | 내일: {tomorrow} | 그저께: {day_before_yesterday}
이번 주 월요일: {week_start} | 지난 주 월요일: {last_week_start} | 다음 주 월요일: {next_week_start}
이번 달 1일: {month_start} | 지난 달 1일: {last_month_start}
→ 상대 날짜 표현을 반드시 위 날짜로 변환해서 저장 (예: "어제" → {yesterday}, "지난 주 화요일" → {last_week_start} + 1일)

=== 사용자 현재 현황 ===
{user_context}

=== 플래너 카테고리 목록 ===
{categories_context}

=== 응답 형식 (JSON only) ===

【단일 액션】 — 기록 1개 처리 또는 조회·대화
{{
  "reply": "사용자에게 보낼 한국어 메시지 (항상 필수, 친근하고 간결하게)",
  "action": "create" | "update" | "delete" | null,
  "module": "<모듈명>" | null,
  "data": {{...}} | null,
  "filter": {{...}} | null,
  "suggestions": ["후속 질문1", "후속 질문2"] | null
}}

【다중 액션】 — 여러 기록을 한 번에 처리할 때 actions 배열 사용 (삭제 제외)
{{
  "reply": "사용자에게 보낼 한국어 메시지",
  "actions": [
    {{"action": "create", "module": "<모듈명>", "data": {{...}}}},
    {{"action": "update", "module": "<모듈명>", "filter": {{...}}, "data": {{...}}}}
  ],
  "suggestions": ["후속 질문1", "후속 질문2"] | null
}}

=== 행동 가이드 ===
1. 일반 대화·질문 → action: null, 현황 데이터 참고해 맞춤 답변
2. 데이터 조회 → action: null, 현황에서 직접 수치 인용해 답변
3. 기록 추가 → action: "create"
4. 기록 수정·상태 변경·완료 처리 → action: "update"
5. 삭제 요청 → action: "delete" (실행 전 사용자 확인)
6. 정보 부족 → action: null으로 추가 정보 요청
7. 종합 근황·생활 분석 → action: null, 모든 도메인 현황 종합해서 인사이트·응원 제공
8. 로드맵 조언·우선순위 → action: null, 플래너 진행률·마감 임박 항목 기반으로 다음 행동 제안
9. 목표 달성 가능성·전략 → action: null, 현황 데이터 기반으로 현실적 피드백
10. 연속·패턴 감지 → 운동 연속 기록, 수면 개선, 저축률 상승 등 긍정적 변화 적극 칭찬
11. 주간 리뷰 → "이번 주 어땠어?", "주간 정리해줘" 등 → 운동·수면·영어·독서·자산 이번 주 지표 한눈에 요약
12. 월간 목표 → "이번 달 목표" → 현재 달 데이터 기반으로 달성 여부 평가 + 남은 기간 전략 제안

=== 코칭 톤 가이드 ===
- 데이터가 좋을 때: 구체적 수치를 언급하며 진심 어린 칭찬 ("지난 주보다 30분 더 운동했네요! 대단해요")
- 데이터가 부진할 때: 비판 대신 공감 + 작은 목표 제시 ("이번 주 운동이 없었네요. 내일 15분만 해볼까요?")
- 마감 임박 항목: 구체적 항목명 언급 + 현실적 조언 ("'알고리즘 스터디' 마감이 3일 남았어요. 지금 시작하면 어때요?")
- 자산 성장: 저축률·트렌드 언급 + 동기부여
- 독서 진행: 현재 읽는 책 언급 + 완독 응원

=== suggestions 사용 규칙 ===
- 조회·분석·대화 응답(action: null)일 때만 포함. 데이터 저장 후에는 생략.
- 2~3개, 짧고 자연스럽게 (7글자 이내 권장)
- 현재 대화 흐름에서 자연스러운 다음 질문이나 행동 제안
- 예: 운동 현황 분석 후 → ["이번 주 목표 세울까?", "수면도 분석해줘"]
- 예: 여행 계획 논의 후 → ["일정 추가해줘", "체크리스트 만들어줘"]
- 예: 플래너 조회 후 → ["우선순위 알려줘", "마감 임박 항목은?"]

=== create 모듈·필드 ===
health_exercise  : log_date(YYYY-MM-DD, 기본 오늘), exercise_type(string), duration_minutes(int), note(선택)
health_sleep     : log_date(YYYY-MM-DD, 기본 오늘), sleep_hours(float), quality(1~5 int, 기본 3), note(선택)
finance_record   : record_date(YYYY-MM-DD), total_assets(int 만원), monthly_income(int), monthly_expense(int), note(선택)
growth_book      : title(string), author(선택), status("planned"|"reading"|"completed", 기본 "planned")
growth_english   : log_date(YYYY-MM-DD, 기본 오늘), activity_type("reading"|"listening"|"speaking"|"writing"|"vocab"), duration_minutes(int), note(선택)
career_cf_rating : log_date(YYYY-MM-DD), rating(int), rank_name(string)
travel_trip      : name(string), destination(string), start_date(YYYY-MM-DD), end_date(YYYY-MM-DD), status("planned"|"ongoing"|"completed", 기본 "planned"), note(선택)
travel_checklist : trip_name(string, 여행 이름으로 특정), text(string)
travel_plan      : trip_name(string, 여행 이름으로 특정), day(int, 1부터), title(string), time(HH:MM 선택), description(선택), sort_order(int 선택)
planner_item     : category_id(int, 위 카테고리 목록에서 선택), text(string), offset(float, 기본 0)

=== update 모듈·필드 ===
filter로 대상 특정, data에 변경할 값만 포함
health_exercise  : filter(log_date, exercise_type), data(duration_minutes, exercise_type, note)
health_sleep     : filter(log_date), data(sleep_hours, quality, note)
finance_record   : filter(record_date), data(total_assets, monthly_income, monthly_expense, note)
growth_book      : filter(title), data(status, rating, note, author, start_date, end_date)
growth_english   : filter(log_date, activity_type), data(duration_minutes, note)
career_cf_rating : filter(log_date), data(rating, rank_name)
travel_trip      : filter(name 또는 destination), data(status, name, destination, note, start_date, end_date)
travel_checklist : filter(trip_name, text), data(text, is_checked)
travel_plan      : filter(trip_name, title), data(title, time, description, day, sort_order)
planner_item     : filter(text), data(text, offset, is_completed)

=== delete 필터 ===
health_exercise  : log_date, exercise_type
health_sleep     : log_date
finance_record   : record_date
growth_book      : title
growth_english   : log_date, activity_type
career_cf_rating : log_date
travel_trip      : name 또는 destination
travel_checklist : trip_name, text
travel_plan      : trip_name, title
planner_item     : text
planner_category : title (⚠️ 카테고리 삭제 시 하위 아이템 전체 삭제됨 — reply에 반드시 경고 포함)

=== 자주 쓰는 패턴 ===
- "책 완독했어" → growth_book update, data: {{"status":"completed","end_date":"{today}"}}
- "책 읽기 시작했어" → growth_book update/create, data: {{"status":"reading","start_date":"{today}"}}
- "독서 평점 줄게" → growth_book update, data: {{"rating":N}}
- "영어 독해 30분" → growth_english create, activity_type: "reading"
- "영어 듣기 1시간" → growth_english create, activity_type: "listening"
- "영어 말하기/쉐도잉" → growth_english create, activity_type: "speaking"
- "영어 단어 공부" → growth_english create, activity_type: "vocab"
- "플래너 항목 완료했어" → planner_item update, data: {{"is_completed":true}}
- "플래너 항목 미완료로 되돌려" → planner_item update, data: {{"is_completed":false}}
- "여행 다녀왔어 / 완료 처리해줘" → travel_trip update, data: {{"status":"completed"}}
- "여행 체크리스트 체크해줘" → travel_checklist update, data: {{"is_checked":true}}
- "이번 주 어땠어? / 주간 정리" → action: null, 운동·수면·영어·독서 이번 주 지표 종합 요약 + 격려
- "이번 달 목표" → action: null, 월간 진행률 평가 + 남은 기간 전략 제안
- "이번 달 자산 기록해줘 (수입 500, 지출 300, 총자산 5000)" → finance_record create, reply에 저축률 계산 포함 ((수입-지출)/수입 * 100 = 40%)
- "어떤 운동 꾸준히 했어?" → 이번 달 ex_rows의 exercise_type 분포 분석 후 답변
- "영어 얼마나 했어?" → 이번 달 + 이번 주 영어 요약 (activity_type별 분류)

=== 예시 ===
사용자: "오늘 러닝 45분 했어"
→ {{"reply":"러닝 45분 기록했어요! 💪", "action":"create", "module":"health_exercise", "data":{{"log_date":"{today}", "exercise_type":"러닝", "duration_minutes":45}}, "filter":null}}

사용자: "파친코 다 읽었어"
→ {{"reply":"파친코 완독 축하해요! 완료로 바꿀게요 🎉", "action":"update", "module":"growth_book", "filter":{{"title":"파친코"}}, "data":{{"status":"completed","end_date":"{today}"}}}}

사용자: "영어 스터디 항목 완료했어"
→ {{"reply":"완료 처리했어요!", "action":"update", "module":"planner_item", "filter":{{"text":"영어 스터디"}}, "data":{{"is_completed":true}}}}

사용자: "요즘 내 생활 어때?"
→ {{"reply":"이번 달 운동 X회, 수면 평균 X시간... (현황 기반 종합 분석)", "action":null, "module":null, "data":null, "filter":null}}

사용자: "다음에 뭘 집중해야 해?"
→ {{"reply":"플래너 마감 임박 항목 기반으로 우선순위 제안...", "action":null, "module":null, "data":null, "filter":null}}

사용자: "어제 수면 8시간, 품질 5점"
→ {{"reply":"수면 기록 완료!", "action":"create", "module":"health_sleep", "data":{{"log_date":"{yesterday}", "sleep_hours":8.0, "quality":5}}, "filter":null}}

사용자: "어제 러닝 시간 60분으로 수정해줘"
→ {{"reply":"어제 러닝을 60분으로 수정했어요!", "action":"update", "module":"health_exercise", "filter":{{"log_date":"{yesterday}", "exercise_type":"러닝"}}, "data":{{"duration_minutes":60}}}}

사용자: "월요일 러닝 30분, 화요일 수영 45분, 수요일 사이클 60분 기록해줘"
→ {{"reply":"이번 주 운동 3일 치 기록했어요! 💪", "actions":[
  {{"action":"create","module":"health_exercise","data":{{"log_date":"{week_start}","exercise_type":"러닝","duration_minutes":30}}}},
  {{"action":"create","module":"health_exercise","data":{{"log_date":"{week_start_plus1}","exercise_type":"수영","duration_minutes":45}}}},
  {{"action":"create","module":"health_exercise","data":{{"log_date":"{week_start_plus2}","exercise_type":"사이클","duration_minutes":60}}}}
]}}

사용자: "오늘 러닝 40분 했고 어젯밤 수면은 7.5시간 품질 4점이야"
→ {{"reply":"운동이랑 수면 모두 기록했어요! 오늘도 고생했어요 😊", "actions":[
  {{"action":"create","module":"health_exercise","data":{{"log_date":"{today}","exercise_type":"러닝","duration_minutes":40}}}},
  {{"action":"create","module":"health_sleep","data":{{"log_date":"{yesterday}","sleep_hours":7.5,"quality":4}}}}
], "suggestions":["이번 주 운동 현황","다음 목표 뭐야?"]}}

사용자: "이번 주 어땠어?"
→ {{"reply":"이번 주 운동 X일/총 Xmin, 수면 평균 X시간, 영어 X분, 독서 상황... (현황 데이터로 구체적 요약 후 응원)", "action":null, "module":null, "data":null, "filter":null, "suggestions":["다음 주 목표 세울까?","개선할 점 알려줘"]}}

사용자: "이번 주 운동을 지난 주보다 많이 했어" (혹은 데이터에서 스트릭 감지)
→ {{"reply":"이번 주 Xmin으로 지난 주(Ymin)보다 Z분 더 운동했어요! 연속 X일 달성 중이에요 🔥 이 기세 계속 가요!", "action":null, "module":null, "data":null, "filter":null, "suggestions":["수면도 확인해줘","이번 달 목표는?"]}}

=== 계획 수립 가이드 ===

**여행 계획 (travel_trip + travel_plan 동시 생성)**
여행과 일정을 한 번에 만들 때 actions 배열 사용. trip_name은 방금 만든 여행 이름과 정확히 일치해야 함.
→ {{"reply":"제주 여행이랑 1일차 일정 추가했어요!","actions":[
  {{"action":"create","module":"travel_trip","data":{{"name":"제주 여행","destination":"제주도","start_date":"2026-08-01","end_date":"2026-08-03","status":"planned"}}}},
  {{"action":"create","module":"travel_plan","data":{{"trip_name":"제주 여행","day":1,"title":"공항 도착 + 성산일출봉","time":"10:00"}}}},
  {{"action":"create","module":"travel_plan","data":{{"trip_name":"제주 여행","day":2,"title":"한라산 등반","time":"07:00"}}}}
]}}

**체크리스트 추가**
→ {{"reply":"체크리스트 추가했어요!","actions":[
  {{"action":"create","module":"travel_checklist","data":{{"trip_name":"제주 여행","text":"여권 확인"}}}},
  {{"action":"create","module":"travel_checklist","data":{{"trip_name":"제주 여행","text":"숙소 예약 확인"}}}}
]}}

**플래너 항목 추가 — offset 안내**
offset = 로드맵 시작일로부터 몇 개월 후 마감 (float). 카테고리 목록에서 subtitle로 적합한 category_id 선택.
- "당장" / "이번 달" → offset: 0.5
- "3개월 후" → offset: 3.0
- "반년" → offset: 6.0
- "1년 후" → offset: 12.0
- 마감 언급 없으면 → offset: 1.0 (기본값)
→ {{"reply":"플래너에 항목 추가했어요!","action":"create","module":"planner_item","data":{{"category_id":<ID>,"text":"알고리즘 스터디 완료","offset":3.0}},"filter":null}}

**다단계 대화로 계획 수립**
- 사용자가 방향만 잡는 단계: action: null로 조언/질문 제공
- 세부 내용 확정 후 "추가해줘" 하면 그때 저장
- 여행 계획 시: 여행 기간 먼저 확인 → travel_trip 생성 → 일정 추가 순서
"""


def _parse_json(text: str) -> dict:
    if not text:
        raise ValueError("빈 응답")
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        text = match.group(1).strip()
    brace = text.find("{")
    if brace > 0:
        text = text[brace:]
    return json.loads(text)


async def _load_categories_context(session: AsyncSession) -> str:
    from app.core.models import Phase, Category, RoadmapSettings  # noqa: F401

    settings_row = (await session.execute(
        select(RoadmapSettings).limit(1)
    )).scalar_one_or_none()
    roadmap_start = settings_row.start_date if settings_row else None

    stmt = (
        select(Phase)
        .options(selectinload(Phase.categories).selectinload(Category.items))
        .order_by(Phase.order_index)
    )
    phases = (await session.execute(stmt)).scalars().all()
    lines = []
    running_months = 0
    for phase in phases:
        if roadmap_start:
            ph_start = roadmap_start + timedelta(days=int(running_months * 30.44))
            ph_end = ph_start + timedelta(days=int((phase.months or 0) * 30.44))
            date_range = f" {ph_start.strftime('%Y.%m')}~{ph_end.strftime('%Y.%m')}"
        else:
            date_range = ""
        running_months += (phase.months or 0)

        for cat in sorted(phase.categories, key=lambda c: c.order_index):
            subtitle = f" — {cat.subtitle}" if cat.subtitle else ""
            incomplete = [i for i in cat.items if not i.is_completed]
            if incomplete:
                sample = ", ".join(f'"{i.text[:20]}"' for i in incomplete[:3])
                extra = f" +{len(incomplete) - 3}개" if len(incomplete) > 3 else ""
                items_str = f" (미완료: {sample}{extra})"
            else:
                items_str = ""
            lines.append(f"  - category_id={cat.id}: [{phase.name}{date_range}] {cat.title}{subtitle}{items_str}")

    if not lines:
        return "  (카테고리 없음 — planner_item 추가 불가, 먼저 플래너 페이지에서 카테고리 생성 필요)"
    return "\n".join(lines)


async def _load_user_context(session: AsyncSession) -> str:
    """사용자 최근 활동 요약 — 단일 트랜잭션 안에서 읽기."""
    from app.modules.health.models import ExerciseLog, SleepLog
    from app.modules.finance.models import AssetRecord
    from app.modules.growth.models import BookRecord, EnglishLog
    from app.modules.career.models import CFRatingLog
    from app.modules.travel.models import Trip
    from app.core.models import RoadmapItem, RoadmapSettings

    today = date.today()
    month_start = today.replace(day=1)
    week_ago = today - timedelta(days=7)
    week_start = today - timedelta(days=today.weekday())  # 이번 주 월요일
    lines = []

    # 이번 달 운동
    ex_rows = (await session.execute(
        select(ExerciseLog)
        .where(ExerciseLog.log_date >= month_start)
        .order_by(ExerciseLog.log_date.desc())
    )).scalars().all()
    if ex_rows:
        total_min = sum(r.duration_minutes for r in ex_rows)
        ex_types = list(dict.fromkeys(r.exercise_type for r in ex_rows))
        lines.append(f"- 이번 달 운동: {len(ex_rows)}회 / 총 {total_min}분 (종류: {', '.join(ex_types[:3])})")
    else:
        lines.append("- 이번 달 운동: 기록 없음")

    # 이번 주 운동 상세 (별도 쿼리 — week_start가 이전 달일 수 있어 month_start 필터와 분리)
    week_ex = (await session.execute(
        select(ExerciseLog)
        .where(ExerciseLog.log_date >= week_start)
        .order_by(ExerciseLog.log_date)
    )).scalars().all()
    if week_ex:
        week_detail = ", ".join(
            f"{r.log_date.strftime('%m/%d')} {r.exercise_type} {r.duration_minutes}분"
            for r in week_ex
        )
        lines.append(f"  → 이번 주: {week_detail}")

    # 지난 주 운동 (이번 주와 비교)
    last_week_start = week_start - timedelta(days=7)
    last_week_ex = (await session.execute(
        select(ExerciseLog)
        .where(ExerciseLog.log_date >= last_week_start)
        .where(ExerciseLog.log_date < week_start)
        .order_by(ExerciseLog.log_date)
    )).scalars().all()
    if last_week_ex:
        last_min = sum(r.duration_minutes for r in last_week_ex)
        curr_min = sum(r.duration_minutes for r in week_ex) if week_ex else 0
        diff = curr_min - last_min
        sign = "+" if diff >= 0 else ""
        lines.append(f"  → 지난 주 대비: {sign}{diff}분 (지난 주 {last_min}분/{len(last_week_ex)}일)")

    # 최근 14일 수면 한 번에 로드해 이번 주/지난 주 비교
    two_weeks_ago = week_ago - timedelta(days=7)
    all_sl = (await session.execute(
        select(SleepLog)
        .where(SleepLog.log_date >= two_weeks_ago)
        .order_by(SleepLog.log_date.desc())
    )).scalars().all()
    sl_rows = [r for r in all_sl if r.log_date >= week_ago]
    if sl_rows:
        avg_sleep = sum(r.sleep_hours for r in sl_rows) / len(sl_rows)
        avg_q = sum(r.quality for r in sl_rows) / len(sl_rows)
        lines.append(f"- 최근 7일 수면: 평균 {avg_sleep:.1f}시간 (품질 {avg_q:.1f}/5, {len(sl_rows)}일 기록)")
        prev_sl = [r for r in all_sl if r.log_date < week_ago]
        if prev_sl:
            prev_avg = sum(r.sleep_hours for r in prev_sl) / len(prev_sl)
            diff = avg_sleep - prev_avg
            sign = "+" if diff >= 0 else ""
            lines.append(f"  → 전주 대비 수면: {sign}{diff:.1f}시간 (전주 평균 {prev_avg:.1f}시간)")
    else:
        lines.append("- 최근 7일 수면: 기록 없음")

    # 최신 자산 + 추이
    asset_rows = (await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(3)
    )).scalars().all()
    asset = asset_rows[0] if asset_rows else None
    if asset:
        savings_rate = 0
        if asset.monthly_income > 0:
            savings_rate = round((asset.monthly_income - asset.monthly_expense) / asset.monthly_income * 100)
        lines.append(
            f"- 자산: {asset.total_assets:,}만원 / 월수입 {asset.monthly_income:,}만원 "
            f"/ 저축률 {savings_rate}% ({asset.record_date})"
        )
        if len(asset_rows) >= 2:
            change = asset_rows[0].total_assets - asset_rows[-1].total_assets
            trend = f"+{change:,}" if change >= 0 else f"{change:,}"
            lines.append(f"  → 최근 {len(asset_rows)}개월 자산 변화: {trend}만원")
    else:
        lines.append("- 자산: 기록 없음")

    # 독서 현황 (읽는 중 전체 + 예정 최대 3권 + 올해 완독 + 평점)
    book_rows = (await session.execute(select(BookRecord))).scalars().all()
    if book_rows:
        reading_books = [b for b in book_rows if b.status == "reading"]
        completed_books = [b for b in book_rows if b.status == "completed"]
        planned_books = [b for b in book_rows if b.status == "planned"]
        this_year = today.year
        completed_this_year = [b for b in completed_books if b.end_date and b.end_date.year == this_year]
        rated_books = [b for b in completed_books if b.rating]
        avg_rating = round(sum(b.rating for b in rated_books) / len(rated_books), 1) if rated_books else None
        rating_str = f" / 평균 평점 {avg_rating}점" if avg_rating else ""
        lines.append(
            f"- 독서: 완독 {len(completed_books)}권(올해 {len(completed_this_year)}권) "
            f"/ 읽는 중 {len(reading_books)}권 / 예정 {len(planned_books)}권{rating_str}"
        )
        if reading_books:
            reading_detail = ", ".join(
                f'"{b.title}"' + (f'({b.author})' if b.author else '')
                for b in reading_books
            )
            lines.append(f"  → 읽는 중: {reading_detail}")
        if planned_books:
            planned_detail = ", ".join(f'"{b.title}"' for b in planned_books[:3])
            lines.append(f"  → 읽을 예정: {planned_detail}")
    else:
        lines.append("- 독서: 기록 없음")

    # 이번 달 영어 (activity_type별 분류) + 이번 주 영어
    eng_rows = (await session.execute(
        select(EnglishLog).where(EnglishLog.log_date >= month_start)
    )).scalars().all()
    if eng_rows:
        eng_min = sum(r.duration_minutes for r in eng_rows)
        type_summary: dict[str, int] = {}
        for r in eng_rows:
            type_summary[r.activity_type] = type_summary.get(r.activity_type, 0) + r.duration_minutes
        type_str = ", ".join(f"{t} {m}분" for t, m in sorted(type_summary.items(), key=lambda x: -x[1]))
        lines.append(f"- 이번 달 영어: {len(eng_rows)}회 / {eng_min}분 ({type_str})")
        # 이번 주 영어 세부
        week_eng = [r for r in eng_rows if r.log_date >= week_start]
        if week_eng:
            week_eng_min = sum(r.duration_minutes for r in week_eng)
            lines.append(f"  → 이번 주: {week_eng_min}분 ({len(week_eng)}회)")
    else:
        lines.append("- 이번 달 영어: 기록 없음")

    # 최근 CF 레이팅
    cf = (await session.execute(
        select(CFRatingLog).order_by(CFRatingLog.log_date.desc()).limit(1)
    )).scalar_one_or_none()
    if cf:
        lines.append(f"- CF 레이팅: {cf.rating} ({cf.rank_name}, {cf.log_date})")
    else:
        lines.append("- CF 레이팅: 기록 없음")

    # 여행 현황 (plan_items + checklist eager load)
    trip_rows = (await session.execute(
        select(Trip)
        .options(selectinload(Trip.plan_items), selectinload(Trip.checklist_items))
        .order_by(Trip.start_date.desc()).limit(5)
    )).scalars().all()
    if trip_rows:
        ongoing = [t for t in trip_rows if t.status == "ongoing"]
        planned = [t for t in trip_rows if t.status == "planned"]
        completed = [t for t in trip_rows if t.status == "completed"]
        trip_parts = []
        if ongoing:
            trip_parts.append(f"진행 중: {ongoing[0].name}({ongoing[0].destination})")
        if planned:
            next_trip = planned[0]
            trip_parts.append(f"예정: {next_trip.name}({next_trip.destination}, {next_trip.start_date}~{next_trip.end_date})")
        if completed:
            trip_parts.append(f"완료 {len(completed)}건")
        lines.append(f"- 여행: {' / '.join(trip_parts) if trip_parts else '기록 있음'}")
        # 예정·진행 중 여행의 일정 + 체크리스트 상세
        for trip in (ongoing + planned)[:2]:
            if trip.plan_items:
                plan_by_day: dict[int, list[str]] = {}
                for item in sorted(trip.plan_items, key=lambda x: (x.day, x.sort_order)):
                    plan_by_day.setdefault(item.day, []).append(item.title)
                plan_str = " / ".join(
                    f"Day{d}: {', '.join(titles[:2])}"
                    for d, titles in list(plan_by_day.items())[:4]
                )
                lines.append(f"  → [{trip.name}] 일정({len(trip.plan_items)}개): {plan_str}")
            if trip.checklist_items:
                checked = sum(1 for c in trip.checklist_items if c.is_checked)
                lines.append(f"  → [{trip.name}] 체크리스트: {checked}/{len(trip.checklist_items)}개 체크됨")
    else:
        lines.append("- 여행: 기록 없음")

    # 플래너 진행률 + Phase별 breakdown + 마감 임박·지연 항목
    from app.core.models import Phase as PhaseModel, Category as PhaseCategory
    settings_row = (await session.execute(
        select(RoadmapSettings).limit(1)
    )).scalar_one_or_none()
    all_items = (await session.execute(select(RoadmapItem))).scalars().all()
    if all_items:
        completed_cnt = sum(1 for i in all_items if i.is_completed)
        total_cnt = len(all_items)
        pct = round(completed_cnt / total_cnt * 100) if total_cnt > 0 else 0
        lines.append(f"- 플래너: 전체 {total_cnt}개 항목 중 {completed_cnt}개 완료 ({pct}%)")

        # Phase별 진행률
        phase_rows = (await session.execute(
            select(PhaseModel)
            .options(selectinload(PhaseModel.categories))
            .order_by(PhaseModel.order_index)
        )).scalars().all()
        if phase_rows:
            item_by_cat: dict[int, list] = {}
            for item in all_items:
                item_by_cat.setdefault(item.category_id, []).append(item)
            phase_parts = []
            for ph in phase_rows:
                ph_items = [i for cat in ph.categories for i in item_by_cat.get(cat.id, [])]
                if ph_items:
                    ph_done = sum(1 for i in ph_items if i.is_completed)
                    phase_parts.append(f"{ph.name}: {ph_done}/{len(ph_items)}")
            if phase_parts:
                lines.append(f"  → Phase별: {' / '.join(phase_parts)}")

        if settings_row and settings_row.start_date:
            roadmap_start = settings_row.start_date
            deadline_list = []
            for item in all_items:
                if item.is_completed:
                    continue
                dl = roadmap_start + timedelta(days=int(item.offset * 30.44))
                days_left = (dl - today).days
                deadline_list.append((item.text, days_left))
            deadline_list.sort(key=lambda x: x[1])
            overdue = [(t, d) for t, d in deadline_list if d < 0][:3]
            urgent = [(t, d) for t, d in deadline_list if 0 <= d <= 30][:3]
            if overdue:
                overdue_str = ", ".join(f'"{t[:15]}"({abs(d)}일 초과)' for t, d in overdue)
                lines.append(f"  → 지연: {overdue_str}")
            if urgent:
                urgent_str = ", ".join(f'"{t[:15]}"({d}일 후)' for t, d in urgent)
                lines.append(f"  → 마감 임박: {urgent_str}")
    else:
        lines.append("- 플래너: 항목 없음")

    return "\n".join(lines)


def _build_history_context(history: list) -> str:
    if not history:
        return ""
    lines = ["\n=== 이전 대화 (최근 순) ==="]
    for msg in history[-10:]:
        role = "사용자" if msg.role == "user" else "AI"
        lines.append(f"{role}: {msg.text[:400]}")
    return "\n".join(lines) + "\n"


async def _process_multi_actions(session: AsyncSession, reply: str, actions: list) -> dict:
    """actions 배열의 create/update를 순서대로 처리. 삭제는 배제(개별 확인 필요)."""
    saved_count = 0
    saved_modules: list[str] = []
    error_parts: list[str] = []

    for act in actions:
        action = act.get("action")
        module = act.get("module")
        data = act.get("data") or {}
        filter_ = act.get("filter") or {}

        if not action or not module:
            continue

        if action == "delete":
            error_parts.append("삭제는 개별 확인이 필요해요")
            continue

        try:
            if action == "create":
                if module == "planner_item":
                    cat_id = data.get("category_id")
                    if not cat_id or not isinstance(cat_id, int):
                        error_parts.append("플래너 항목 추가 실패 (카테고리 ID 필요)")
                        continue
                await _create(session, module, data)
                # flush: 다음 액션이 이 데이터를 참조할 수 있도록 DB에 전송 (commit 아님)
                # 예) travel_trip 생성 후 travel_plan 항목이 trip_name으로 조회 가능
                await session.flush()

            elif action == "update":
                updated = await _update(session, module, filter_, data)
                if not updated:
                    error_parts.append(f"수정 대상을 찾지 못했어요")
                    continue
            else:
                continue

            saved_count += 1
            if module not in saved_modules:
                saved_modules.append(module)

        except IntegrityError:
            # rollback은 이전 flush까지 모두 취소 → saved_count 초기화
            saved_count = 0
            saved_modules = []
            await session.rollback()
            error_parts.append("중복 기록이 있어요")
        except Exception as e:
            error_parts.append(f"저장 실패: {str(e)[:40]}")

    if saved_count > 0:
        try:
            await session.commit()
        except Exception as e:
            await session.rollback()
            return {"reply": f"저장 중 오류가 발생했어요: {str(e)[:60]}", "saved": False, "saved_count": 0}

    final_reply = reply
    if error_parts:
        final_reply += "\n\n⚠️ " + " / ".join(error_parts)

    return {
        "reply": final_reply,
        "saved": saved_count > 0,
        "saved_count": saved_count,
        "module": saved_modules[0] if saved_modules else None,
        "modules": saved_modules if saved_modules else None,
        "action": "create" if saved_count > 0 else None,
        "suggestions": None,
    }


async def parse_and_save(
    session: AsyncSession, user_input: str, history: list | None = None
) -> dict:
    if not settings.gemini_api_key:
        return {"reply": "Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 추가해주세요.", "saved": False}

    categories_context = await _load_categories_context(session)
    user_context = await _load_user_context(session)

    gemini = genai.Client(api_key=settings.gemini_api_key)
    _today = date.today()
    _yesterday = _today - timedelta(days=1)
    _week_start = _today - timedelta(days=_today.weekday())
    _month_start = _today.replace(day=1)
    system_prompt = _SYSTEM_PROMPT.format(
        today=_today.isoformat(),
        yesterday=_yesterday.isoformat(),
        tomorrow=(_today + timedelta(days=1)).isoformat(),
        day_before_yesterday=(_today - timedelta(days=2)).isoformat(),
        week_start=_week_start.isoformat(),
        last_week_start=(_week_start - timedelta(days=7)).isoformat(),
        next_week_start=(_week_start + timedelta(days=7)).isoformat(),
        month_start=_month_start.isoformat(),
        last_month_start=(_month_start - timedelta(days=1)).replace(day=1).isoformat(),
        week_start_plus1=(_week_start + timedelta(days=1)).isoformat(),
        week_start_plus2=(_week_start + timedelta(days=2)).isoformat(),
        categories_context=categories_context,
        user_context=user_context,
    )

    # 대화 히스토리를 Gemini 네이티브 멀티턴 포맷으로 변환
    # system_instruction은 별도 파라미터로 분리 → 모델이 맥락을 훨씬 잘 유지함
    contents: list[dict] = []
    for msg in (history or [])[-20:]:
        role = "user" if msg.role == "user" else "model"
        # AI 메시지는 800자, 사용자 메시지는 300자로 제한 (사용자 의도는 짧고 AI 맥락은 더 중요)
        limit = 800 if role == "model" else 300
        contents.append({"role": role, "parts": [{"text": msg.text[:limit]}]})

    # Gemini 멀티턴은 반드시 user 턴으로 시작해야 함
    while contents and contents[0]["role"] != "user":
        contents.pop(0)

    # 현재 사용자 입력을 마지막 user 턴으로 추가
    contents.append({"role": "user", "parts": [{"text": user_input}]})

    response = await asyncio.to_thread(
        gemini.models.generate_content,
        model="gemini-3.1-flash-lite",
        contents=contents,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
        ),
    )

    try:
        parsed = _parse_json(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError):
        raw = getattr(response, "text", "") or "응답을 처리하지 못했어요."
        return {"reply": raw, "saved": False, "module": None, "action": None}

    reply = parsed.get("reply") or "응답을 처리하지 못했어요."
    suggestions = parsed.get("suggestions") or None
    if suggestions and not isinstance(suggestions, list):
        suggestions = None

    # 다중 액션 배열 처리
    raw_actions = parsed.get("actions")
    if raw_actions and isinstance(raw_actions, list):
        result = await _process_multi_actions(session, reply, raw_actions)
        result["suggestions"] = suggestions
        return result

    # 단일 액션 처리
    action = parsed.get("action")
    module = parsed.get("module")

    if not action or not module:
        return {"reply": reply, "saved": False, "saved_count": 0, "module": module, "action": action, "suggestions": suggestions}

    if action == "create":
        data = parsed.get("data") or {}

        if module == "planner_item":
            cat_id = data.get("category_id")
            if not cat_id or not isinstance(cat_id, int):
                return {
                    "reply": "플래너 카테고리가 없어요. 플래너 페이지에서 카테고리를 먼저 만들어주세요!",
                    "saved": False,
                    "module": module,
                    "action": action,
                    "suggestions": None,
                }

        try:
            await _create(session, module, data)
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return {
                "reply": f"{reply}\n\n⚠️ 이미 해당 날짜에 기록이 있어요. 기존 기록을 수정하거나 삭제 후 다시 시도해주세요.",
                "saved": False,
                "module": module,
                "action": action,
                "suggestions": None,
            }
        except Exception as exc:
            await session.rollback()
            return {
                "reply": f"저장에 필요한 정보가 부족해요. 좀 더 구체적으로 말씀해 주세요.\n({type(exc).__name__}: {exc})",
                "saved": False,
                "module": module,
                "action": action,
                "suggestions": None,
            }
        return {"reply": reply, "saved": True, "saved_count": 1, "module": module, "action": "create", "suggestions": None}

    if action == "update":
        try:
            updated = await _update(session, module, parsed.get("filter") or {}, parsed.get("data") or {})
            if updated:
                await session.commit()
        except Exception as exc:
            await session.rollback()
            return {
                "reply": f"수정에 필요한 정보가 부족해요. 좀 더 구체적으로 말씀해 주세요.\n({type(exc).__name__}: {exc})",
                "saved": False,
                "saved_count": 0,
                "module": module,
                "action": action,
                "suggestions": None,
            }
        if not updated:
            return {"reply": "수정할 기록을 찾지 못했어요.", "saved": False, "saved_count": 0, "module": module, "action": action, "suggestions": None}
        return {"reply": reply, "saved": True, "saved_count": 1, "module": module, "action": "update", "suggestions": None}

    if action == "delete":
        return {
            "reply": reply,
            "saved": False,
            "module": module,
            "action": "delete_pending",
            "pending_filter": parsed.get("filter") or {},
            "suggestions": None,
        }

    return {"reply": reply, "saved": False, "module": module, "action": action, "suggestions": None}


async def execute_delete(session: AsyncSession, module: str, filter_: dict) -> bool:
    try:
        result = await _delete(session, module, filter_)
        if result:
            await session.commit()
        return result
    except Exception:
        await session.rollback()
        raise


def _safe_date(s: str) -> date | None:
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _escape_like(s: str) -> str:
    """Escape LIKE metacharacters so user-supplied strings match literally."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def _find_record(session: AsyncSession, module: str, filter_: dict):
    """filter_ 기준으로 레코드 1개를 WHERE 쿼리로 탐색. 없으면 None."""
    from app.modules.health.models import ExerciseLog, SleepLog
    from app.modules.finance.models import AssetRecord
    from app.modules.growth.models import BookRecord, EnglishLog
    from app.modules.career.models import CFRatingLog
    from app.modules.travel.models import Trip

    if module == "health_exercise":
        q = select(ExerciseLog)
        if d := _safe_date(filter_.get("log_date", "")):
            q = q.where(ExerciseLog.log_date == d)
        if t := filter_.get("exercise_type"):
            q = q.where(ExerciseLog.exercise_type.ilike(f"%{_escape_like(t)}%", escape="\\"))
        return (await session.execute(q.order_by(ExerciseLog.log_date.desc()).limit(1))).scalars().first()

    if module == "health_sleep":
        q = select(SleepLog)
        if d := _safe_date(filter_.get("log_date", "")):
            q = q.where(SleepLog.log_date == d)
        return (await session.execute(q.order_by(SleepLog.log_date.desc()).limit(1))).scalars().first()

    if module == "finance_record":
        q = select(AssetRecord)
        if d := _safe_date(filter_.get("record_date", "")):
            q = q.where(AssetRecord.record_date == d)
        return (await session.execute(q.order_by(AssetRecord.record_date.desc()).limit(1))).scalars().first()

    if module == "growth_book":
        title_q = filter_.get("title", "")
        if not title_q:
            return None
        q = select(BookRecord).where(BookRecord.title.ilike(f"%{_escape_like(title_q)}%", escape="\\"))
        return (await session.execute(q.order_by(BookRecord.id.desc()).limit(1))).scalars().first()

    if module == "growth_english":
        q = select(EnglishLog)
        if d := _safe_date(filter_.get("log_date", "")):
            q = q.where(EnglishLog.log_date == d)
        if t := filter_.get("activity_type"):
            q = q.where(EnglishLog.activity_type.ilike(f"%{_escape_like(t)}%", escape="\\"))
        return (await session.execute(q.order_by(EnglishLog.log_date.desc()).limit(1))).scalars().first()

    if module == "career_cf_rating":
        q = select(CFRatingLog)
        if d := _safe_date(filter_.get("log_date", "")):
            q = q.where(CFRatingLog.log_date == d)
        return (await session.execute(q.order_by(CFRatingLog.log_date.desc()).limit(1))).scalars().first()

    if module == "travel_trip":
        # name 매치 우선, 없으면 destination 매치
        n, dest = filter_.get("name", ""), filter_.get("destination", "")
        if not n and not dest:
            return None
        record = None
        if n:
            record = (await session.execute(
                select(Trip).where(Trip.name.ilike(f"%{_escape_like(n)}%", escape="\\")).order_by(Trip.start_date.desc()).limit(1)
            )).scalars().first()
        if record is None and dest:
            record = (await session.execute(
                select(Trip).where(Trip.destination.ilike(f"%{_escape_like(dest)}%", escape="\\")).order_by(Trip.start_date.desc()).limit(1)
            )).scalars().first()
        return record

    if module == "travel_checklist":
        from app.modules.travel.models import TripChecklistItem
        text_q = filter_.get("text", "")
        if not text_q:
            return None
        q = select(TripChecklistItem).where(
            TripChecklistItem.text.ilike(f"%{_escape_like(text_q)}%", escape="\\")
        )
        trip_name = filter_.get("trip_name", "")
        if trip_name:
            q = q.join(Trip, TripChecklistItem.trip_id == Trip.id).where(
                Trip.name.ilike(f"%{_escape_like(trip_name)}%", escape="\\")
            )
        return (await session.execute(q.limit(1))).scalars().first()

    if module == "travel_plan":
        from app.modules.travel.models import TripPlanItem
        title_q = filter_.get("title", "")
        if not title_q:
            return None
        q = select(TripPlanItem).where(
            TripPlanItem.title.ilike(f"%{_escape_like(title_q)}%", escape="\\")
        )
        trip_name = filter_.get("trip_name", "")
        if trip_name:
            q = q.join(Trip, TripPlanItem.trip_id == Trip.id).where(
                Trip.name.ilike(f"%{_escape_like(trip_name)}%", escape="\\")
            )
        return (await session.execute(q.limit(1))).scalars().first()

    if module == "planner_item":
        from app.core.models import RoadmapItem
        text_q = filter_.get("text", "")
        if not text_q:
            return None
        q = select(RoadmapItem).where(RoadmapItem.text.ilike(f"%{_escape_like(text_q)}%", escape="\\"))
        return (await session.execute(q.order_by(RoadmapItem.id.desc()).limit(1))).scalars().first()

    if module == "planner_category":
        from app.core.models import Category, RoadmapItem
        from sqlalchemy.orm import selectinload
        title_q = filter_.get("title", "")
        if not title_q:
            return None
        q = (
            select(Category)
            .options(selectinload(Category.items))
            .where(Category.title.ilike(f"%{_escape_like(title_q)}%", escape="\\"))
        )
        return (await session.execute(q.order_by(Category.id.desc()).limit(1))).scalars().first()

    return None


_DATE_FIELDS = {"log_date", "record_date", "start_date", "end_date"}


async def _update(session: AsyncSession, module: str, filter_: dict, data: dict) -> bool:
    """filter로 대상을 찾아 data의 필드만 부분 수정."""
    record = await _find_record(session, module, filter_)
    if record is None:
        return False
    for field, value in data.items():
        if value is not None and hasattr(record, field):
            if field in _DATE_FIELDS and isinstance(value, str):
                value = _safe_date(value)
            setattr(record, field, value)
    return True


async def _create(session: AsyncSession, module: str, data: dict) -> None:
    """sub-service를 거치지 않고 직접 ORM 객체를 추가해 session.begin() 중첩을 방지."""
    from app.modules.health.models import ExerciseLog, SleepLog
    from app.modules.health.schemas import ExerciseLogCreate, SleepLogCreate
    from app.modules.finance.models import AssetRecord
    from app.modules.finance.schemas import AssetRecordCreate
    from app.modules.growth.models import BookRecord, EnglishLog
    from app.modules.growth.schemas import BookRecordCreate, EnglishLogCreate
    from app.modules.career.models import CFRatingLog
    from app.modules.career.schemas import CFRatingLogCreate
    from app.modules.travel.models import Trip, TripChecklistItem
    from app.modules.travel.schemas import TripCreate, ChecklistItemCreate
    from app.core.models import RoadmapItem, Category
    from app.modules.planner.schemas import RoadmapItemCreate

    data = dict(data)  # 호출자 dict 변경 방지

    if module == "health_exercise":
        session.add(ExerciseLog(**ExerciseLogCreate(**data).model_dump()))

    elif module == "health_sleep":
        session.add(SleepLog(**SleepLogCreate(**data).model_dump()))

    elif module == "finance_record":
        session.add(AssetRecord(**AssetRecordCreate(**data).model_dump()))

    elif module == "growth_book":
        session.add(BookRecord(**BookRecordCreate(**data).model_dump()))

    elif module == "growth_english":
        session.add(EnglishLog(**EnglishLogCreate(**data).model_dump()))

    elif module == "career_cf_rating":
        session.add(CFRatingLog(**CFRatingLogCreate(**data).model_dump()))

    elif module == "travel_trip":
        session.add(Trip(**TripCreate(**data).model_dump()))

    elif module == "travel_checklist":
        trip_name = data.pop("trip_name", None)
        trip_id = data.pop("trip_id", None)
        if trip_name:
            trip = (await session.execute(
                select(Trip).where(Trip.name.ilike(f"%{_escape_like(trip_name)}%", escape="\\")).limit(1)
            )).scalars().first()
            if trip is None:
                raise ValueError(f"'{trip_name}' 여행을 찾을 수 없습니다")
        elif trip_id:
            trip = await session.get(Trip, int(trip_id))
            if trip is None:
                raise ValueError(f"trip_id={trip_id}인 여행을 찾을 수 없습니다")
        else:
            raise ValueError("trip_name 또는 trip_id가 필요합니다")
        session.add(TripChecklistItem(trip_id=trip.id, **ChecklistItemCreate(**data).model_dump()))

    elif module == "travel_plan":
        from app.modules.travel.models import TripPlanItem
        from app.modules.travel.schemas import PlanItemCreate
        trip_name = data.pop("trip_name", None)
        if not trip_name:
            raise ValueError("trip_name이 필요합니다")
        trip = (await session.execute(
            select(Trip).where(Trip.name.ilike(f"%{_escape_like(trip_name)}%", escape="\\")).limit(1)
        )).scalars().first()
        if trip is None:
            raise ValueError(f"'{trip_name}' 여행을 찾을 수 없습니다")
        session.add(TripPlanItem(trip_id=trip.id, **PlanItemCreate(**data).model_dump()))

    elif module == "planner_item":
        item_data = RoadmapItemCreate(**data)
        cat = await session.get(Category, item_data.category_id)
        if cat is None:
            raise ValueError(f"category_id={item_data.category_id}를 찾을 수 없습니다")
        session.add(RoadmapItem(
            category_id=item_data.category_id,
            text=item_data.text,
            offset=item_data.offset,
            is_completed=False,
        ))


async def _delete(session: AsyncSession, module: str, filter_: dict) -> bool:
    """filter로 대상을 찾아 삭제. 커밋은 호출부(execute_delete)에서 처리."""
    from sqlalchemy import delete as sa_delete

    match = await _find_record(session, module, filter_)
    if match is None:
        return False

    # DB에 ON DELETE CASCADE가 없는 경우 하위 레코드를 먼저 명시 삭제
    if module == "planner_category":
        from app.core.models import RoadmapItem
        await session.execute(sa_delete(RoadmapItem).where(RoadmapItem.category_id == match.id))

    await session.delete(match)
    return True


async def generate_weekly_report(session: AsyncSession) -> str:
    """이번 주 전체 데이터를 모아 Gemini로 주간 라이프 리포트를 생성."""
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    from app.modules.dashboard.service import get_overview

    today = date.today()
    overview = await get_overview(session)

    planner = overview.planner
    finance = overview.finance
    health = overview.health
    growth = overview.growth
    career = overview.career

    def fmt(v, suffix="", default="N/A"):
        return f"{v}{suffix}" if v is not None else default

    prompt = f"""당신은 5년 라이프 로드맵을 관리하는 사용자의 개인 라이프 코치입니다.
아래 이번 주 데이터를 분석하고, 한국어로 주간 리포트를 작성해주세요.

## 이번 주 데이터 ({today} 기준)

**플래너 (5년 로드맵)**
- 전체 목표: {fmt(planner.total_items if planner else None, "개")} / 완료: {fmt(planner.completed_items if planner else None, "개")} / 긴급: {fmt(planner.urgent_items if planner else None, "개")} / 초과: {fmt(planner.overdue_items if planner else None, "개")}

**재테크**
- 총 자산: {f"{finance.latest_total_assets:,}만원" if finance and finance.latest_total_assets else "N/A"}
- 최근 3개월 평균 저축률: {fmt(finance.avg_savings_rate if finance else None, "%")}

**건강**
- 이번 주 운동: {fmt(health.exercise_days_this_week if health else None, "일")} / 총 {fmt(health.total_exercise_minutes_this_week if health else None, "분")}
- 평균 수면: {fmt(health.avg_sleep_hours_this_week if health else None, "시간")} / 품질 {fmt(health.avg_sleep_quality_this_week if health else None, "/5")}

**자기계발**
- 올해 완독: {fmt(growth.books_completed_this_year if growth else None, "권")} / 읽는 중: {fmt(growth.books_reading if growth else None, "권")}
- 이번 달 영어: {fmt(growth.english_days_this_month if growth else None, "일")} / {fmt(growth.english_minutes_this_month if growth else None, "분")}

**커리어**
- Codeforces 레이팅: {fmt(career.latest_cf_rating if career else None)} ({career.latest_cf_rank if career and career.latest_cf_rank else "—"})

## 리포트 형식 (마크다운)

### 📊 이번 주 요약
(2-3줄, 핵심 성과와 현황)

### ✅ 잘 한 점
(데이터 기반으로 2-3가지)

### 💡 개선할 점
(솔직하고 건설적으로 2-3가지)

### 🎯 다음 주 제안
(실행 가능한 구체적 행동 3가지)

격려하되 솔직하게, 반드시 데이터에 근거해서 작성해주세요."""

    ai_client = genai.Client(api_key=settings.gemini_api_key)
    response = await asyncio.to_thread(
        ai_client.models.generate_content,
        model="gemini-3.1-flash-lite",
        contents=prompt,
    )
    return response.text
