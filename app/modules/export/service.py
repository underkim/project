import csv
import io

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.career import service as career_svc
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.health import service as health_svc
from app.modules.travel import service as travel_svc

# 모듈별 CSV 헤더 (빈 데이터셋에도 동일한 헤더 행을 출력하기 위해 명시)
FINANCE_FIELDS = ["날짜", "총자산(만원)", "월수입(만원)", "월지출(만원)", "저축액(만원)", "저축률(%)", "메모"]
EXERCISE_FIELDS = ["날짜", "운동종류", "시간(분)", "메모"]
SLEEP_FIELDS = ["날짜", "수면시간(시간)", "품질(1-5)", "메모"]
BOOK_FIELDS = ["제목", "저자", "상태", "시작일", "완료일", "평점", "메모"]
ENGLISH_FIELDS = ["날짜", "활동종류", "시간(분)", "메모"]
CAREER_FIELDS = ["날짜", "레이팅", "랭크"]
TRAVEL_FIELDS = ["여행명", "목적지", "시작일", "종료일", "상태", "체크리스트", "일정", "맛집", "메모"]


def _to_csv(rows: list[dict], fieldnames: list[str]) -> bytes:
    """딕셔너리 리스트 → UTF-8 BOM CSV 바이트 (Excel 호환).

    rows가 비어 있어도 fieldnames로 헤더 행을 출력한다.
    """
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return ("﻿" + buf.getvalue()).encode("utf-8")


async def export_finance(session: AsyncSession) -> bytes:
    records = await finance_svc.list_records(session, limit=10000)
    rows = [
        {
            "날짜": str(r.record_date),
            "총자산(만원)": r.total_assets,
            "월수입(만원)": r.monthly_income,
            "월지출(만원)": r.monthly_expense,
            "저축액(만원)": r.savings_amount,
            "저축률(%)": r.savings_rate if r.savings_rate is not None else "",
            "메모": r.note or "",
        }
        for r in records
    ]
    return _to_csv(rows, FINANCE_FIELDS)


async def export_exercise(session: AsyncSession) -> bytes:
    logs = await health_svc.list_exercise(session, limit=10000)
    rows = [
        {
            "날짜": str(r.log_date),
            "운동종류": r.exercise_type,
            "시간(분)": r.duration_minutes,
            "메모": r.note or "",
        }
        for r in logs
    ]
    return _to_csv(rows, EXERCISE_FIELDS)


async def export_sleep(session: AsyncSession) -> bytes:
    logs = await health_svc.list_sleep(session, limit=10000)
    rows = [
        {
            "날짜": str(r.log_date),
            "수면시간(시간)": r.sleep_hours,
            "품질(1-5)": r.quality,
            "메모": r.note or "",
        }
        for r in logs
    ]
    return _to_csv(rows, SLEEP_FIELDS)


async def export_books(session: AsyncSession) -> bytes:
    books = await growth_svc.list_books(session, limit=10000)
    rows = [
        {
            "제목": r.title,
            "저자": r.author or "",
            "상태": r.status,
            "시작일": str(r.start_date) if r.start_date else "",
            "완료일": str(r.end_date) if r.end_date else "",
            "평점": r.rating if r.rating is not None else "",
            "메모": r.note or "",
        }
        for r in books
    ]
    return _to_csv(rows, BOOK_FIELDS)


async def export_english(session: AsyncSession) -> bytes:
    logs = await growth_svc.list_english(session, limit=10000)
    rows = [
        {
            "날짜": str(r.log_date),
            "활동종류": r.activity_type,
            "시간(분)": r.duration_minutes,
            "메모": r.note or "",
        }
        for r in logs
    ]
    return _to_csv(rows, ENGLISH_FIELDS)


async def export_career(session: AsyncSession) -> bytes:
    ratings = await career_svc.list_cf_ratings(session, limit=10000)
    rows = [
        {"날짜": str(r.log_date), "레이팅": r.rating, "랭크": r.rank_name}
        for r in ratings
    ]
    return _to_csv(rows, CAREER_FIELDS)


async def export_travel(session: AsyncSession) -> bytes:
    trips = await travel_svc.list_trips(session)
    rows = []
    for t in trips:
        checklist = "; ".join(
            f"{'[✓]' if item.is_checked else '[ ]'} {item.text}"
            for item in t.checklist_items
        )
        plan = "; ".join(
            f"Day{item.day} {item.time or ''} {item.title}"
            for item in sorted(t.plan_items, key=lambda x: (x.day, x.sort_order))
        )
        # 맛집: 이름(분류) + 방문 여부. 좌표는 내보내지 않는다(지도 표시용 내부 필드).
        restaurants = "; ".join(
            f"{'[✓]' if r.is_visited else '[ ]'} {r.name}"
            + (f" ({r.cuisine})" if r.cuisine else "")
            for r in sorted(t.restaurants, key=lambda x: x.order_index)
        )
        rows.append(
            {
                "여행명": t.name,
                "목적지": t.destination,
                "시작일": str(t.start_date),
                "종료일": str(t.end_date),
                "상태": t.status,
                "체크리스트": checklist,
                "일정": plan,
                "맛집": restaurants,
                "메모": t.note or "",
            }
        )
    return _to_csv(rows, TRAVEL_FIELDS)
