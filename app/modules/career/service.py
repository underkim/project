from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.career.models import CFRatingLog, CareerSettings
from app.modules.career.schemas import (
    CFRatingLogCreate,
    CFRatingLogResponse,
    CFRatingLogUpdate,
    CareerSettingsResponse,
    CareerSettingsUpdate,
    CareerSummaryResponse,
)


async def get_settings(session: AsyncSession) -> CareerSettingsResponse:
    result = await session.execute(select(CareerSettings))
    settings = result.scalar_one_or_none()
    if settings is None:
        return CareerSettingsResponse(cf_handle=None, github_username=None, blog_url=None)
    return CareerSettingsResponse.model_validate(settings)


async def update_settings(
    session: AsyncSession, data: CareerSettingsUpdate
) -> CareerSettingsResponse:
    async with session.begin():
        result = await session.execute(select(CareerSettings))
        settings = result.scalar_one_or_none()
        if settings is None:
            settings = CareerSettings(id=1, **data.model_dump())
            session.add(settings)
        else:
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(settings, field, value)
    return CareerSettingsResponse.model_validate(settings)


async def list_cf_ratings(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[CFRatingLogResponse]:
    result = await session.execute(
        select(CFRatingLog).order_by(CFRatingLog.log_date.desc()).limit(limit).offset(offset)
    )
    return [CFRatingLogResponse.model_validate(r) for r in result.scalars().all()]


async def create_cf_rating(
    session: AsyncSession, data: CFRatingLogCreate
) -> CFRatingLogResponse:
    async with session.begin():
        log = CFRatingLog(**data.model_dump())
        session.add(log)
    return CFRatingLogResponse.model_validate(log)


async def update_cf_rating(
    session: AsyncSession, log_id: int, data: CFRatingLogUpdate
) -> CFRatingLogResponse | None:
    async with session.begin():
        log = await session.get(CFRatingLog, log_id)
        if log is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(log, field, value)
    return CFRatingLogResponse.model_validate(log)


async def delete_cf_rating(session: AsyncSession, log_id: int) -> bool:
    async with session.begin():
        log = await session.get(CFRatingLog, log_id)
        if log is None:
            return False
        await session.delete(log)
    return True


async def get_summary(session: AsyncSession) -> CareerSummaryResponse:
    settings = await get_settings(session)

    top2_result = await session.execute(
        select(CFRatingLog).order_by(CFRatingLog.log_date.desc()).limit(2)
    )
    top2 = top2_result.scalars().all()
    latest = top2[0] if top2 else None
    prev = top2[1] if len(top2) > 1 else None

    peak_row = (await session.execute(
        select(func.max(CFRatingLog.rating))
    )).scalar_one_or_none()

    rating_delta = (latest.rating - prev.rating) if (latest and prev) else None

    return CareerSummaryResponse(
        cf_handle=settings.cf_handle,
        github_username=settings.github_username,
        latest_cf_rating=latest.rating if latest else None,
        latest_cf_rank=latest.rank_name if latest else None,
        peak_cf_rating=peak_row,
        rating_delta=rating_delta,
    )
