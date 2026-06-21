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
from app.modules.health import service as health_svc
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.career import service as career_svc


_SYSTEM_PROMPT = """\
너는 라이프 대시보드 앱에 내장된 AI 어시스턴트야.
사용자의 5년 로드맵을 함께 관리하면서, 자연스럽게 대화하고 필요할 때 데이터를 기록·수정·삭제해줘.
짧고 친근하게 말하되, 데이터 처리 결과는 명확하게 알려줘.

오늘 날짜: {today}

=== 사용자 현재 현황 ===
{user_context}

=== 플래너 카테고리 ===
{categories_context}

=== 응답 형식 (JSON only) ===
{{
  "reply": "사용자에게 보낼 한국어 메시지 (항상 필수, 친근하고 간결하게)",
  "action": "create" | "update" | "delete" | null,
  "module": "<모듈명>" | null,
  "data": {{...}} | null,
  "filter": {{...}} | null
}}

=== 행동 가이드 ===
1. 일반 대화·질문·조언 → action: null, 현황 데이터 참고해 맞춤 답변
2. 데이터 조회 → action: null, 현황에서 직접 수치 인용해 답변
3. 기록 추가 → action: "create"
4. 기록 수정 → action: "update" (filter로 대상 특정, data에 바꿀 값만)
5. 삭제 요청 → action: "delete" (filter로 대상 특정, 실행 전 사용자 확인)
6. 정보 부족 → action: null으로 추가 정보 요청

=== create 모듈·필드 ===
health_exercise  : log_date(YYYY-MM-DD, 기본 오늘), exercise_type(string), duration_minutes(int), note(선택)
health_sleep     : log_date(YYYY-MM-DD, 기본 오늘), sleep_hours(float), quality(1~5 int, 기본 3), note(선택)
finance_record   : record_date(YYYY-MM-DD), total_assets(int 만원), monthly_income(int), monthly_expense(int), note(선택)
growth_book      : title(string), author(선택), status("planned"|"reading"|"completed", 기본 "planned")
growth_english   : log_date(YYYY-MM-DD, 기본 오늘), activity_type("reading"|"listening"|"speaking"|"writing"|"vocab"), duration_minutes(int), note(선택)
career_cf_rating : log_date(YYYY-MM-DD), rating(int), rank_name(string)
travel_trip      : name(string), destination(string), start_date(YYYY-MM-DD), end_date(YYYY-MM-DD), status("planned"|"ongoing"|"completed", 기본 "planned"), note(선택)
travel_checklist : trip_id(int, 위 여행 목록에서 선택), text(string), order_index(int, 기본 0)
planner_item     : category_id(int, 위 카테고리 목록에서 선택), text(string), offset(float, 기본 0)

=== update 모듈·필드 ===
filter로 대상 특정, data에 변경할 값만 포함
health_exercise  : filter(log_date, exercise_type), data(duration_minutes, exercise_type, note)
health_sleep     : filter(log_date), data(sleep_hours, quality, note)
finance_record   : filter(record_date), data(total_assets, monthly_income, monthly_expense, note)
growth_book      : filter(title), data(status, rating, note, author)
growth_english   : filter(log_date, activity_type), data(duration_minutes, note)
career_cf_rating : filter(log_date), data(rating, rank_name)
travel_trip      : filter(name 또는 destination), data(status, name, destination, note)

=== delete 필터 ===
health_exercise  : log_date, exercise_type
health_sleep     : log_date
finance_record   : record_date
growth_book      : title
growth_english   : log_date, activity_type
career_cf_rating : log_date
travel_trip      : name 또는 destination
(planner_item 삭제·수정 미지원)

=== 예시 ===
사용자: "오늘 러닝 45분 했어"
→ {{"reply":"러닝 45분 기록했어요!", "action":"create", "module":"health_exercise", "data":{{"log_date":"{today}", "exercise_type":"러닝", "duration_minutes":45}}, "filter":null}}

사용자: "어제 수면 8시간, 품질 5점"
→ {{"reply":"수면 기록 완료!", "action":"create", "module":"health_sleep", "data":{{"log_date":"<어제날짜>", "sleep_hours":8.0, "quality":5}}, "filter":null}}

사용자: "이번 달 운동 몇 번 했어?"
→ {{"reply":"이번 달 운동 X회 하셨어요!", "action":null, "module":null, "data":null, "filter":null}}

사용자: "어제 러닝 시간 60분으로 수정해줘"
→ {{"reply":"어제 러닝을 60분으로 수정했어요!", "action":"update", "module":"health_exercise", "filter":{{"log_date":"<어제날짜>", "exercise_type":"러닝"}}, "data":{{"duration_minutes":60}}}}
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
    from app.core.models import Phase, Category  # noqa: F401

    stmt = (
        select(Phase)
        .options(selectinload(Phase.categories))
        .order_by(Phase.order_index)
    )
    phases = (await session.execute(stmt)).scalars().all()
    lines = []
    for phase in phases:
        for cat in sorted(phase.categories, key=lambda c: c.order_index):
            lines.append(f"  - category_id={cat.id}: [{phase.name}] {cat.title}")

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

    today = date.today()
    month_start = today.replace(day=1)
    week_ago = today - timedelta(days=7)
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
        latest_ex = ex_rows[0]
        lines.append(f"  → 최근: {latest_ex.log_date} {latest_ex.exercise_type} {latest_ex.duration_minutes}분")
    else:
        lines.append("- 이번 달 운동: 기록 없음")

    # 최근 7일 수면
    sl_rows = (await session.execute(
        select(SleepLog)
        .where(SleepLog.log_date >= week_ago)
        .order_by(SleepLog.log_date.desc())
    )).scalars().all()
    if sl_rows:
        avg_sleep = sum(r.sleep_hours for r in sl_rows) / len(sl_rows)
        avg_q = sum(r.quality for r in sl_rows) / len(sl_rows)
        lines.append(f"- 최근 7일 수면: 평균 {avg_sleep:.1f}시간 (품질 {avg_q:.1f}/5, {len(sl_rows)}일 기록)")
    else:
        lines.append("- 최근 7일 수면: 기록 없음")

    # 최신 자산
    asset = (await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(1)
    )).scalar_one_or_none()
    if asset:
        savings_rate = 0
        if asset.monthly_income > 0:
            savings_rate = round((asset.monthly_income - asset.monthly_expense) / asset.monthly_income * 100)
        lines.append(
            f"- 자산: {asset.total_assets:,}만원 / 월수입 {asset.monthly_income:,}만원 "
            f"/ 저축률 {savings_rate}% ({asset.record_date})"
        )
    else:
        lines.append("- 자산: 기록 없음")

    # 독서 현황
    book_rows = (await session.execute(select(BookRecord))).scalars().all()
    if book_rows:
        reading = [b.title for b in book_rows if b.status == "reading"]
        completed_cnt = sum(1 for b in book_rows if b.status == "completed")
        planned_cnt = sum(1 for b in book_rows if b.status == "planned")
        reading_str = f" (읽는 중: {reading[0][:20]})" if reading else ""
        lines.append(f"- 독서: 완독 {completed_cnt}권 / 예정 {planned_cnt}권{reading_str}")
    else:
        lines.append("- 독서: 기록 없음")

    # 이번 달 영어
    eng_rows = (await session.execute(
        select(EnglishLog).where(EnglishLog.log_date >= month_start)
    )).scalars().all()
    if eng_rows:
        eng_min = sum(r.duration_minutes for r in eng_rows)
        lines.append(f"- 이번 달 영어: {len(eng_rows)}회 / {eng_min}분")
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

    # 여행 현황
    trip_rows = (await session.execute(
        select(Trip).order_by(Trip.start_date.desc()).limit(5)
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
        trip_list = ", ".join(f"id={t.id} {t.name}" for t in trip_rows[:3])
        lines.append(f"  → 최근 여행 목록: {trip_list}")
    else:
        lines.append("- 여행: 기록 없음")

    return "\n".join(lines)


def _build_history_context(history: list) -> str:
    if not history:
        return ""
    lines = ["\n=== 이전 대화 (최근 순) ==="]
    for msg in history[-10:]:
        role = "사용자" if msg.role == "user" else "AI"
        lines.append(f"{role}: {msg.text[:400]}")
    return "\n".join(lines) + "\n"


async def parse_and_save(
    session: AsyncSession, user_input: str, history: list | None = None
) -> dict:
    if not settings.gemini_api_key:
        return {"reply": "Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 추가해주세요.", "saved": False}

    categories_context = await _load_categories_context(session)
    user_context = await _load_user_context(session)
    history_context = _build_history_context(history or [])

    gemini = genai.Client(api_key=settings.gemini_api_key)
    today_str = date.today().isoformat()
    prompt = (
        _SYSTEM_PROMPT.format(
            today=today_str,
            categories_context=categories_context,
            user_context=user_context,
        )
        + history_context
        + f"\n사용자: {user_input}"
    )

    response = await asyncio.to_thread(
        gemini.models.generate_content,
        model="gemini-3.1-flash-lite",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        parsed = _parse_json(response.text)
    except (json.JSONDecodeError, ValueError, AttributeError):
        raw = getattr(response, "text", "") or "응답을 처리하지 못했어요."
        return {"reply": raw, "saved": False, "module": None, "action": None}

    reply = parsed.get("reply") or "응답을 처리하지 못했어요."
    action = parsed.get("action")
    module = parsed.get("module")

    if not action or not module:
        return {"reply": reply, "saved": False, "module": module, "action": action}

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
                }

        try:
            await _create(session, module, data)
        except IntegrityError:
            await session.rollback()
            return {
                "reply": f"{reply}\n\n⚠️ 이미 해당 날짜에 기록이 있어요. 기존 기록을 수정하거나 삭제 후 다시 시도해주세요.",
                "saved": False,
                "module": module,
                "action": action,
            }
        except Exception as exc:
            await session.rollback()
            return {
                "reply": f"저장에 필요한 정보가 부족해요. 좀 더 구체적으로 말씀해 주세요.\n({type(exc).__name__}: {exc})",
                "saved": False,
                "module": module,
                "action": action,
            }
        return {"reply": reply, "saved": True, "module": module, "action": "create"}

    if action == "update":
        try:
            updated = await _update(session, module, parsed.get("filter") or {}, parsed.get("data") or {})
        except Exception as exc:
            await session.rollback()
            return {
                "reply": f"수정에 필요한 정보가 부족해요. 좀 더 구체적으로 말씀해 주세요.\n({type(exc).__name__}: {exc})",
                "saved": False,
                "module": module,
                "action": action,
            }
        if not updated:
            return {"reply": "수정할 기록을 찾지 못했어요.", "saved": False, "module": module, "action": action}
        return {"reply": reply, "saved": True, "module": module, "action": "update"}

    if action == "delete":
        return {
            "reply": reply,
            "saved": False,
            "module": module,
            "action": "delete_pending",
            "pending_filter": parsed.get("filter") or {},
        }

    return {"reply": reply, "saved": False, "module": module, "action": action}


async def execute_delete(session: AsyncSession, module: str, filter_: dict) -> bool:
    return await _delete(session, module, filter_)


async def _update(session: AsyncSession, module: str, filter_: dict, data: dict) -> bool:
    """filter로 대상을 찾아 data의 필드만 부분 수정."""
    from app.modules.health.models import ExerciseLog, SleepLog
    from app.modules.finance.models import AssetRecord
    from app.modules.growth.models import BookRecord, EnglishLog
    from app.modules.career.models import CFRatingLog
    from app.modules.travel.models import Trip

    async with session.begin():
        record = None

        if module == "health_exercise":
            rows = (await session.execute(
                select(ExerciseLog).order_by(ExerciseLog.log_date.desc())
            )).scalars().all()
            record = _find_orm(rows, filter_, date_key="log_date", type_key="exercise_type")

        elif module == "health_sleep":
            rows = (await session.execute(
                select(SleepLog).order_by(SleepLog.log_date.desc())
            )).scalars().all()
            record = _find_orm(rows, filter_, date_key="log_date")

        elif module == "finance_record":
            rows = (await session.execute(
                select(AssetRecord).order_by(AssetRecord.record_date.desc())
            )).scalars().all()
            record = _find_orm(rows, filter_, date_key="record_date")

        elif module == "growth_book":
            rows = (await session.execute(
                select(BookRecord).order_by(BookRecord.id.desc())
            )).scalars().all()
            title_q = filter_.get("title", "").lower()
            record = next((r for r in rows if title_q and title_q in r.title.lower()), None)

        elif module == "growth_english":
            rows = (await session.execute(
                select(EnglishLog).order_by(EnglishLog.log_date.desc())
            )).scalars().all()
            record = _find_orm(rows, filter_, date_key="log_date", type_key="activity_type")

        elif module == "career_cf_rating":
            rows = (await session.execute(
                select(CFRatingLog).order_by(CFRatingLog.log_date.desc())
            )).scalars().all()
            record = _find_orm(rows, filter_, date_key="log_date")

        elif module == "travel_trip":
            rows = (await session.execute(
                select(Trip).order_by(Trip.start_date.desc())
            )).scalars().all()
            record = _find_trip(rows, filter_)

        else:
            return False

        if record is None:
            return False

        for field, value in data.items():
            if value is not None and hasattr(record, field):
                setattr(record, field, value)

    return True


async def _create(session: AsyncSession, module: str, data: dict) -> None:
    from app.modules.health.schemas import ExerciseLogCreate, SleepLogCreate
    from app.modules.finance.schemas import AssetRecordCreate
    from app.modules.growth.schemas import BookRecordCreate, EnglishLogCreate
    from app.modules.career.schemas import CFRatingLogCreate
    from app.modules.planner.schemas import RoadmapItemCreate
    from app.modules.travel.schemas import TripCreate, ChecklistItemCreate
    from app.modules.travel import service as travel_svc
    from app.modules.planner import service as planner_svc

    if module == "health_exercise":
        await health_svc.create_exercise(session, ExerciseLogCreate(**data))
    elif module == "health_sleep":
        await health_svc.create_sleep(session, SleepLogCreate(**data))
    elif module == "finance_record":
        await finance_svc.create_record(session, AssetRecordCreate(**data))
    elif module == "growth_book":
        await growth_svc.create_book(session, BookRecordCreate(**data))
    elif module == "growth_english":
        await growth_svc.create_english(session, EnglishLogCreate(**data))
    elif module == "career_cf_rating":
        await career_svc.create_cf_rating(session, CFRatingLogCreate(**data))
    elif module == "travel_trip":
        await travel_svc.create_trip(session, TripCreate(**data))
    elif module == "travel_checklist":
        trip_id = data.pop("trip_id", None)
        if not trip_id:
            raise ValueError("trip_id가 필요합니다")
        await travel_svc.add_checklist_item(session, int(trip_id), ChecklistItemCreate(**data))
    elif module == "planner_item":
        await planner_svc.create_item(session, RoadmapItemCreate(**data))


async def _delete(session: AsyncSession, module: str, filter_: dict) -> bool:
    """하나의 트랜잭션 안에서 select → delete."""
    from app.modules.health.models import ExerciseLog, SleepLog
    from app.modules.finance.models import AssetRecord
    from app.modules.growth.models import BookRecord, EnglishLog
    from app.modules.career.models import CFRatingLog
    from app.modules.travel.models import Trip

    async with session.begin():
        match = None

        if module == "health_exercise":
            rows = (await session.execute(
                select(ExerciseLog).order_by(ExerciseLog.log_date.desc())
            )).scalars().all()
            match = _find_orm(rows, filter_, date_key="log_date", type_key="exercise_type")

        elif module == "health_sleep":
            rows = (await session.execute(
                select(SleepLog).order_by(SleepLog.log_date.desc())
            )).scalars().all()
            match = _find_orm(rows, filter_, date_key="log_date")

        elif module == "finance_record":
            rows = (await session.execute(
                select(AssetRecord).order_by(AssetRecord.record_date.desc())
            )).scalars().all()
            match = _find_orm(rows, filter_, date_key="record_date")

        elif module == "growth_book":
            rows = (await session.execute(
                select(BookRecord).order_by(BookRecord.id.desc())
            )).scalars().all()
            title_q = filter_.get("title", "").lower()
            match = next((r for r in rows if title_q and title_q in r.title.lower()), None)

        elif module == "growth_english":
            rows = (await session.execute(
                select(EnglishLog).order_by(EnglishLog.log_date.desc())
            )).scalars().all()
            match = _find_orm(rows, filter_, date_key="log_date", type_key="activity_type")

        elif module == "career_cf_rating":
            rows = (await session.execute(
                select(CFRatingLog).order_by(CFRatingLog.log_date.desc())
            )).scalars().all()
            match = _find_orm(rows, filter_, date_key="log_date")

        elif module == "travel_trip":
            rows = (await session.execute(
                select(Trip).order_by(Trip.start_date.desc())
            )).scalars().all()
            match = _find_trip(rows, filter_)

        else:
            return False

        if match is None:
            return False
        await session.delete(match)

    return True


def _find_trip(rows: list, filter_: dict):
    name_q = filter_.get("name", "").lower()
    dest_q = filter_.get("destination", "").lower()
    for r in rows:
        if name_q and name_q in r.name.lower():
            return r
        if dest_q and dest_q in r.destination.lower():
            return r
    return None


def _find_orm(
    records: list,
    filter_: dict,
    date_key: str = "log_date",
    type_key: str | None = None,
):
    date_q = (
        filter_.get(date_key)
        or filter_.get("log_date")
        or filter_.get("record_date")
    )
    type_q = filter_.get(type_key, "").lower() if type_key else None

    candidates = records
    if date_q:
        candidates = [r for r in candidates if str(getattr(r, date_key, "")) == str(date_q)]
    if type_q and type_key:
        candidates = [r for r in candidates if type_q in getattr(r, type_key, "").lower()]

    return candidates[0] if candidates else None
