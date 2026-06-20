from __future__ import annotations

import json
import re
from datetime import date

from google import genai
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.health import service as health_svc
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.career import service as career_svc


_SYSTEM_PROMPT = """\
너는 라이프 대시보드 앱의 데이터 입력/삭제 도우미야.
사용자의 한국어 자연어 입력을 받아서, 아래 형식의 JSON 하나만 반환해.
JSON 외 다른 텍스트는 절대 포함하지 마.

오늘 날짜: {today}

=== 지원 모듈 & 필드 ===

health_exercise (운동):
  create: log_date(YYYY-MM-DD, 기본 오늘), exercise_type(string), duration_minutes(int), note(선택)
  delete_filter: log_date(선택), exercise_type(선택)  ← 가장 최근 매칭 기록 삭제

health_sleep (수면):
  create: log_date(YYYY-MM-DD, 기본 오늘), sleep_hours(float), quality(1~5, 기본 4), note(선택)
  delete_filter: log_date(선택)

finance_record (재테크):
  create: record_date(YYYY-MM-DD, 기본 오늘), total_assets(int 만원), monthly_income(int 만원), monthly_expense(int 만원), note(선택)
  delete_filter: record_date(선택)

growth_book (독서):
  create: title(string), author(선택), status("planned"|"reading"|"completed")
  delete_filter: title(부분 일치 가능)

growth_english (영어 학습):
  create: log_date(YYYY-MM-DD, 기본 오늘), activity_type("reading"|"listening"|"speaking"|"writing"|"vocab"), duration_minutes(int), note(선택)
  delete_filter: log_date(선택), activity_type(선택)

career_cf_rating (CF 레이팅):
  create: log_date(YYYY-MM-DD, 기본 오늘), rating(int), rank_name(string)
  delete_filter: log_date(선택)

=== 응답 형식 ===

추가 요청:
{{
  "action": "create",
  "module": "<모듈명>",
  "data": {{ 필드들 }},
  "message": "한국어 확인 메시지 (예: 러닝 35분 기록했어요!)"
}}

삭제 요청:
{{
  "action": "delete",
  "module": "<모듈명>",
  "filter": {{ 삭제 기준 필드들 }},
  "message": "한국어 확인 메시지 (예: 오늘 러닝 기록을 삭제했어요!)"
}}

파악 불가:
{{
  "action": null,
  "module": null,
  "data": null,
  "filter": null,
  "message": "뭘 할지 조금 더 자세히 말해줄 수 있어요?"
}}
"""


def _parse_json(text: str) -> dict:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


async def parse_and_save(session: AsyncSession, user_input: str) -> dict:
    if not settings.gemini_api_key:
        return {"message": "Gemini API 키가 설정되지 않았습니다.", "saved": False}

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = _SYSTEM_PROMPT.format(today=date.today().isoformat()) + f"\n\n사용자 입력: {user_input}"

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    parsed = _parse_json(response.text)

    action = parsed.get("action")
    module = parsed.get("module")
    message = parsed.get("message", "처리했습니다.")

    if not action or not module:
        return {"message": message, "saved": False}

    if action == "create":
        await _create(session, module, parsed.get("data") or {})
        return {"message": message, "saved": True, "module": module, "action": "create"}

    if action == "delete":
        deleted = await _delete(session, module, parsed.get("filter") or {})
        if deleted:
            return {"message": message, "saved": True, "module": module, "action": "delete"}
        return {"message": "삭제할 기록을 찾지 못했어요.", "saved": False}

    return {"message": message, "saved": False}


async def _create(session: AsyncSession, module: str, data: dict) -> None:
    from app.modules.health.schemas import ExerciseLogCreate, SleepLogCreate
    from app.modules.finance.schemas import AssetRecordCreate
    from app.modules.growth.schemas import BookRecordCreate, EnglishLogCreate
    from app.modules.career.schemas import CFRatingLogCreate

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


async def _delete(session: AsyncSession, module: str, filter_: dict) -> bool:
    """필터 조건에 맞는 가장 최근 기록 1건 삭제."""

    if module == "health_exercise":
        records = await health_svc.list_exercise(session)
        match = _find(records, filter_, date_key="log_date", type_key="exercise_type")
        return await health_svc.delete_exercise(session, match.id) if match else False

    if module == "health_sleep":
        records = await health_svc.list_sleep(session)
        match = _find(records, filter_, date_key="log_date")
        return await health_svc.delete_sleep(session, match.id) if match else False

    if module == "finance_record":
        records = await finance_svc.list_records(session)
        match = _find(records, filter_, date_key="record_date")
        return await finance_svc.delete_record(session, match.id) if match else False

    if module == "growth_book":
        records = await growth_svc.list_books(session)
        title_q = filter_.get("title", "").lower()
        match = next((r for r in records if title_q and title_q in r.title.lower()), None)
        if not match and records:
            match = records[0]  # 필터 없으면 가장 최근 항목
        return await growth_svc.delete_book(session, match.id) if match else False

    if module == "growth_english":
        records = await growth_svc.list_english(session)
        match = _find(records, filter_, date_key="log_date", type_key="activity_type")
        return await growth_svc.delete_english(session, match.id) if match else False

    if module == "career_cf_rating":
        records = await career_svc.list_cf_ratings(session)
        match = _find(records, filter_, date_key="log_date")
        return await career_svc.delete_cf_rating(session, match.id) if match else False

    return False


def _find(records: list, filter_: dict, date_key: str = "log_date", type_key: str | None = None):
    """날짜·유형 필터로 가장 최근 매칭 기록 반환."""
    date_q = filter_.get(date_key) or filter_.get("log_date") or filter_.get("record_date")
    type_q = filter_.get(type_key, "").lower() if type_key else None

    candidates = records
    if date_q:
        candidates = [r for r in candidates if getattr(r, date_key, None) == date_q]
    if type_q and type_key:
        candidates = [r for r in candidates if type_q in getattr(r, type_key, "").lower()]

    # 리스트는 최신순 정렬이라 가정 → 첫 번째 반환
    return candidates[0] if candidates else (records[0] if records else None)
