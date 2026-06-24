import csv
import io

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.career import service as career_svc
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.health import service as health_svc


def _to_csv(rows: list[dict]) -> bytes:
    """딕셔너리 리스트 → UTF-8 BOM CSV 바이트 (Excel 호환)."""
    if not rows:
        return "﻿".encode("utf-8")
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
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
    return _to_csv(rows)


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
    return _to_csv(rows)


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
    return _to_csv(rows)


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
    return _to_csv(rows)


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
    return _to_csv(rows)


async def export_career(session: AsyncSession) -> bytes:
    ratings = await career_svc.list_cf_ratings(session, limit=10000)
    rows = [
        {"날짜": str(r.log_date), "레이팅": r.rating, "랭크": r.rank_name}
        for r in ratings
    ]
    return _to_csv(rows)
