from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.models import AssetRecord
from app.modules.finance.schemas import (
    AssetRecordCreate,
    AssetRecordResponse,
    AssetRecordUpdate,
    FinanceSummaryResponse,
)


def _to_response(record: AssetRecord) -> AssetRecordResponse:
    savings = record.monthly_income - record.monthly_expense
    rate = (savings / record.monthly_income * 100) if record.monthly_income else None
    return AssetRecordResponse(
        id=record.id,
        record_date=record.record_date,
        total_assets=record.total_assets,
        monthly_income=record.monthly_income,
        monthly_expense=record.monthly_expense,
        savings_amount=savings,
        savings_rate=round(rate, 1) if rate is not None else None,
        note=record.note,
    )


async def list_records(session: AsyncSession) -> list[AssetRecordResponse]:
    result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc())
    )
    return [_to_response(r) for r in result.scalars().all()]


async def get_record(session: AsyncSession, record_id: int) -> AssetRecordResponse | None:
    record = await session.get(AssetRecord, record_id)
    return _to_response(record) if record else None


async def create_record(
    session: AsyncSession, data: AssetRecordCreate
) -> AssetRecordResponse:
    async with session.begin():
        record = AssetRecord(**data.model_dump())
        session.add(record)
    return _to_response(record)


async def update_record(
    session: AsyncSession, record_id: int, data: AssetRecordUpdate
) -> AssetRecordResponse | None:
    async with session.begin():
        record = await session.get(AssetRecord, record_id)
        if record is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(record, field, value)
    return _to_response(record)


async def delete_record(session: AsyncSession, record_id: int) -> bool:
    async with session.begin():
        record = await session.get(AssetRecord, record_id)
        if record is None:
            return False
        await session.delete(record)
    return True


async def get_summary(session: AsyncSession) -> FinanceSummaryResponse:
    result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc())
    )
    records = result.scalars().all()
    responses = [_to_response(r) for r in records]

    latest_assets = records[0].total_assets if records else None
    recent_rates = [r.savings_rate for r in responses[:3] if r.savings_rate is not None]
    avg_rate = round(sum(recent_rates) / len(recent_rates), 1) if recent_rates else None

    return FinanceSummaryResponse(
        latest_total_assets=latest_assets,
        avg_savings_rate=avg_rate,
        records=responses,
    )
