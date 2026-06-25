from datetime import date, timedelta

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.health.models import ExerciseLog, SleepLog
from app.modules.health.schemas import (
    ExerciseLogCreate,
    ExerciseLogResponse,
    ExerciseLogUpdate,
    HealthSummaryResponse,
    SleepLogCreate,
    SleepLogResponse,
    SleepLogUpdate,
)


async def list_exercise(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[ExerciseLogResponse]:
    result = await session.execute(
        select(ExerciseLog).order_by(ExerciseLog.log_date.desc()).limit(limit).offset(offset)
    )
    return [ExerciseLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_exercise(
    session: AsyncSession, data: ExerciseLogCreate
) -> ExerciseLogResponse:
    async with session.begin():
        log = ExerciseLog(**data.model_dump())
        session.add(log)
    return ExerciseLogResponse.model_validate(log)


async def update_exercise(session: AsyncSession, log_id: int, data: ExerciseLogUpdate) -> ExerciseLogResponse | None:
    async with session.begin():
        log = await session.get(ExerciseLog, log_id)
        if log is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(log, field, value)
    return ExerciseLogResponse.model_validate(log)


async def delete_exercise(session: AsyncSession, log_id: int) -> bool:
    async with session.begin():
        log = await session.get(ExerciseLog, log_id)
        if log is None:
            return False
        await session.delete(log)
    return True


async def list_sleep(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[SleepLogResponse]:
    result = await session.execute(
        select(SleepLog).order_by(SleepLog.log_date.desc()).limit(limit).offset(offset)
    )
    return [SleepLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_sleep(
    session: AsyncSession, data: SleepLogCreate
) -> SleepLogResponse:
    async with session.begin():
        log = SleepLog(**data.model_dump())
        session.add(log)
    return SleepLogResponse.model_validate(log)


async def update_sleep(session: AsyncSession, log_id: int, data: SleepLogUpdate) -> SleepLogResponse | None:
    async with session.begin():
        log = await session.get(SleepLog, log_id)
        if log is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(log, field, value)
    return SleepLogResponse.model_validate(log)


async def delete_sleep(session: AsyncSession, log_id: int) -> bool:
    async with session.begin():
        log = await session.get(SleepLog, log_id)
        if log is None:
            return False
        await session.delete(log)
    return True


async def get_summary(session: AsyncSession) -> HealthSummaryResponse:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # 이번 주 월요일

    ex_row = (await session.execute(
        select(
            func.count(distinct(ExerciseLog.log_date)).label("days"),
            func.coalesce(func.sum(ExerciseLog.duration_minutes), 0).label("minutes"),
        ).where(ExerciseLog.log_date >= week_start)
    )).one()

    sl_row = (await session.execute(
        select(
            func.avg(SleepLog.sleep_hours).label("avg_hours"),
            func.avg(SleepLog.quality).label("avg_quality"),
        ).where(SleepLog.log_date >= week_start)
    )).one()

    avg_sleep = round(sl_row.avg_hours, 1) if sl_row.avg_hours is not None else None
    avg_quality = round(sl_row.avg_quality, 1) if sl_row.avg_quality is not None else None

    return HealthSummaryResponse(
        exercise_days_this_week=ex_row.days,
        total_exercise_minutes_this_week=ex_row.minutes,
        avg_sleep_hours_this_week=avg_sleep,
        avg_sleep_quality_this_week=avg_quality,
    )
