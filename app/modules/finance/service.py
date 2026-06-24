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


async def list_records(session: AsyncSession, limit: int = 20, offset: int = 0) -> list[AssetRecordResponse]:
    result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(limit).offset(offset)
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


async def get_summary(
    session: AsyncSession, records_limit: int = 20, records_offset: int = 0
) -> FinanceSummaryResponse:
    # 요약 통계용: 최신 3개만 조회
    stat_result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(3)
    )
    stat_records = stat_result.scalars().all()
    latest_assets = stat_records[0].total_assets if stat_records else None
    stat_responses = [_to_response(r) for r in stat_records]
    recent_rates = [r.savings_rate for r in stat_responses if r.savings_rate is not None]
    avg_rate = round(sum(recent_rates) / len(recent_rates), 1) if recent_rates else None

    # 목록: 페이지네이션 적용 (records_limit=0이면 목록 쿼리 생략)
    if records_limit == 0:
        return FinanceSummaryResponse(
            latest_total_assets=latest_assets,
            avg_savings_rate=avg_rate,
            records=[],
        )
    list_result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(records_limit).offset(records_offset)
    )
    responses = [_to_response(r) for r in list_result.scalars().all()]

    return FinanceSummaryResponse(
        latest_total_assets=latest_assets,
        avg_savings_rate=avg_rate,
        records=responses,
    )
