from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.health.models import ExerciseLog, SleepLog
from app.modules.health.schemas import (
    ExerciseLogCreate,
    ExerciseLogResponse,
    HealthSummaryResponse,
    SleepLogCreate,
    SleepLogResponse,
)


async def list_exercise(session: AsyncSession) -> list[ExerciseLogResponse]:
    result = await session.execute(
        select(ExerciseLog).order_by(ExerciseLog.log_date.desc())
    )
    return [ExerciseLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_exercise(
    session: AsyncSession, data: ExerciseLogCreate
) -> ExerciseLogResponse:
    async with session.begin():
        log = ExerciseLog(**data.model_dump())
        session.add(log)
    return ExerciseLogResponse.model_validate(log)


async def delete_exercise(session: AsyncSession, log_id: int) -> bool:
    async with session.begin():
        log = await session.get(ExerciseLog, log_id)
        if log is None:
            return False
        await session.delete(log)
    return True


async def list_sleep(session: AsyncSession) -> list[SleepLogResponse]:
    result = await session.execute(
        select(SleepLog).order_by(SleepLog.log_date.desc())
    )
    return [SleepLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_sleep(
    session: AsyncSession, data: SleepLogCreate
) -> SleepLogResponse:
    async with session.begin():
        log = SleepLog(**data.model_dump())
        session.add(log)
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

    ex_result = await session.execute(
        select(ExerciseLog).where(ExerciseLog.log_date >= week_start)
    )
    exercises = ex_result.scalars().all()

    sl_result = await session.execute(
        select(SleepLog).where(SleepLog.log_date >= week_start)
    )
    sleeps = sl_result.scalars().all()

    ex_days = len({e.log_date for e in exercises})
    ex_minutes = sum(e.duration_minutes for e in exercises)
    avg_sleep = round(sum(s.sleep_hours for s in sleeps) / len(sleeps), 1) if sleeps else None
    avg_quality = round(sum(s.quality for s in sleeps) / len(sleeps), 1) if sleeps else None

    return HealthSummaryResponse(
        exercise_days_this_week=ex_days,
        total_exercise_minutes_this_week=ex_minutes,
        avg_sleep_hours_this_week=avg_sleep,
        avg_sleep_quality_this_week=avg_quality,
    )
