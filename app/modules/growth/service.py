from datetime import date

from sqlalchemy import and_, case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.growth.models import BookRecord, EnglishLog
from app.modules.growth.schemas import (
    BookRecordCreate,
    BookRecordResponse,
    BookRecordUpdate,
    EnglishLogCreate,
    EnglishLogResponse,
    EnglishLogUpdate,
    GrowthSummaryResponse,
)


async def list_books(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[BookRecordResponse]:
    result = await session.execute(select(BookRecord).order_by(BookRecord.id.desc()).limit(limit).offset(offset))
    return [BookRecordResponse.model_validate(r) for r in result.scalars().all()]


async def create_book(session: AsyncSession, data: BookRecordCreate) -> BookRecordResponse:
    async with session.begin():
        book = BookRecord(**data.model_dump())
        session.add(book)
    return BookRecordResponse.model_validate(book)


async def update_book(
    session: AsyncSession, book_id: int, data: BookRecordUpdate
) -> BookRecordResponse | None:
    async with session.begin():
        book = await session.get(BookRecord, book_id)
        if book is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(book, field, value)
        if book.start_date is not None and book.end_date is not None and book.end_date < book.start_date:
            raise ValueError("완료일은 시작일 이후여야 합니다")
    return BookRecordResponse.model_validate(book)


async def delete_book(session: AsyncSession, book_id: int) -> bool:
    async with session.begin():
        book = await session.get(BookRecord, book_id)
        if book is None:
            return False
        await session.delete(book)
    return True


async def list_english(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[EnglishLogResponse]:
    result = await session.execute(
        select(EnglishLog).order_by(EnglishLog.log_date.desc()).limit(limit).offset(offset)
    )
    return [EnglishLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_english(
    session: AsyncSession, data: EnglishLogCreate
) -> EnglishLogResponse:
    async with session.begin():
        log = EnglishLog(**data.model_dump())
        session.add(log)
    return EnglishLogResponse.model_validate(log)


async def update_english(
    session: AsyncSession, log_id: int, data: EnglishLogUpdate
) -> EnglishLogResponse | None:
    async with session.begin():
        log = await session.get(EnglishLog, log_id)
        if log is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(log, field, value)
    return EnglishLogResponse.model_validate(log)


async def delete_english(session: AsyncSession, log_id: int) -> bool:
    async with session.begin():
        log = await session.get(EnglishLog, log_id)
        if log is None:
            return False
        await session.delete(log)
    return True


async def get_summary(session: AsyncSession) -> GrowthSummaryResponse:
    today = date.today()
    year_start = date(today.year, 1, 1)
    month_start = date(today.year, today.month, 1)

    book_row = (await session.execute(
        select(
            func.count(case((and_(BookRecord.status == "completed", BookRecord.end_date >= year_start), 1))).label("completed_this_year"),
            func.count(case((BookRecord.status == "reading", 1))).label("reading"),
        ).select_from(BookRecord)
    )).one()

    eng_row = (await session.execute(
        select(
            func.count(distinct(EnglishLog.log_date)).label("days"),
            func.coalesce(func.sum(EnglishLog.duration_minutes), 0).label("minutes"),
        ).where(EnglishLog.log_date >= month_start)
    )).one()
    eng_days = eng_row.days
    eng_minutes = eng_row.minutes

    return GrowthSummaryResponse(
        books_completed_this_year=book_row.completed_this_year,
        books_reading=book_row.reading,
        english_days_this_month=eng_days,
        english_minutes_this_month=eng_minutes,
    )
