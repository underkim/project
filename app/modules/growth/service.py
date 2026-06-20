from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.growth.models import BookRecord, EnglishLog
from app.modules.growth.schemas import (
    BookRecordCreate,
    BookRecordResponse,
    BookRecordUpdate,
    EnglishLogCreate,
    EnglishLogResponse,
    GrowthSummaryResponse,
)


async def list_books(session: AsyncSession) -> list[BookRecordResponse]:
    result = await session.execute(select(BookRecord).order_by(BookRecord.id.desc()))
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
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(book, field, value)
    return BookRecordResponse.model_validate(book)


async def delete_book(session: AsyncSession, book_id: int) -> bool:
    async with session.begin():
        book = await session.get(BookRecord, book_id)
        if book is None:
            return False
        await session.delete(book)
    return True


async def list_english(session: AsyncSession) -> list[EnglishLogResponse]:
    result = await session.execute(
        select(EnglishLog).order_by(EnglishLog.log_date.desc())
    )
    return [EnglishLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_english(
    session: AsyncSession, data: EnglishLogCreate
) -> EnglishLogResponse:
    async with session.begin():
        log = EnglishLog(**data.model_dump())
        session.add(log)
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

    book_result = await session.execute(select(BookRecord))
    books = book_result.scalars().all()

    completed_this_year = sum(
        1 for b in books
        if b.status == "completed" and b.end_date and b.end_date >= year_start
    )
    reading = sum(1 for b in books if b.status == "reading")

    eng_result = await session.execute(
        select(EnglishLog).where(EnglishLog.log_date >= month_start)
    )
    logs = eng_result.scalars().all()
    eng_days = len({l.log_date for l in logs})
    eng_minutes = sum(l.duration_minutes for l in logs)

    return GrowthSummaryResponse(
        books_completed_this_year=completed_this_year,
        books_reading=reading,
        english_days_this_month=eng_days,
        english_minutes_this_month=eng_minutes,
    )
