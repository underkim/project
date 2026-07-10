from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.finance.models import AssetRecord, FinanceGoal
from app.modules.finance.schemas import (
    AssetRecordCreate,
    AssetRecordResponse,
    AssetRecordUpdate,
    FinanceGoalResponse,
    FinanceGoalUpdate,
    FinanceSummaryResponse,
    GoalScenario,
)

SCENARIO_RATES = [0.0, 3.0, 5.0, 7.0, 10.0]


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
        for field, value in data.model_dump(exclude_unset=True).items():
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
    latest_record_date = stat_records[0].record_date if stat_records else None
    asset_change = (stat_records[0].total_assets - stat_records[1].total_assets) if len(stat_records) >= 2 else None
    stat_responses = [_to_response(r) for r in stat_records]
    recent_rates = [r.savings_rate for r in stat_responses if r.savings_rate is not None]
    avg_rate = round(sum(recent_rates) / len(recent_rates), 1) if recent_rates else None

    # 목록: 페이지네이션 적용 (records_limit=0이면 목록 쿼리 생략)
    if records_limit == 0:
        return FinanceSummaryResponse(
            latest_total_assets=latest_assets,
            avg_savings_rate=avg_rate,
            asset_change=asset_change,
            latest_record_date=latest_record_date,
            records=[],
        )
    list_result = await session.execute(
        select(AssetRecord).order_by(AssetRecord.record_date.desc()).limit(records_limit).offset(records_offset)
    )
    responses = [_to_response(r) for r in list_result.scalars().all()]

    return FinanceSummaryResponse(
        latest_total_assets=latest_assets,
        avg_savings_rate=avg_rate,
        asset_change=asset_change,
        latest_record_date=latest_record_date,
        records=responses,
    )


def _months_remaining(today: date, target_date: date) -> int:
    if target_date <= today:
        return 0
    rd = relativedelta(target_date, today)
    months = rd.years * 12 + rd.months
    if rd.days > 0:
        months += 1
    return max(months, 1)


def compute_goal_projection(
    current_assets: int | None,
    target_amount: int | None,
    target_date: date | None,
    annual_rate_pct: float,
    today: date,
) -> tuple[float | None, int | None, int | None, bool]:
    """(progress_pct, months_remaining, required_monthly_saving, achieved) 계산.

    required_monthly_saving은 현재 자산이 매달 annual_rate_pct(연 수익률)로 복리 성장하고,
    남은 개월 동안 동일 금액을 매달 추가로 저축/투자한다고 가정한 연금(annuity) 공식 기반.
    """
    if target_amount is None or target_date is None or current_assets is None:
        return None, None, None, False

    achieved = current_assets >= target_amount
    progress_pct = round(min(100.0, current_assets / target_amount * 100), 1)
    months_remaining = _months_remaining(today, target_date)

    if achieved:
        return progress_pct, months_remaining, 0, True

    n = max(months_remaining, 1)
    monthly_rate = annual_rate_pct / 100 / 12
    future_value_current = current_assets * (1 + monthly_rate) ** n
    remaining = target_amount - future_value_current

    if remaining <= 0:
        required = 0
    elif monthly_rate > 0:
        required = remaining * monthly_rate / ((1 + monthly_rate) ** n - 1)
    else:
        required = remaining / n

    return progress_pct, months_remaining, round(required), achieved


async def _get_latest_assets(session: AsyncSession) -> int | None:
    result = await session.execute(
        select(AssetRecord.total_assets).order_by(AssetRecord.record_date.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def get_goal(session: AsyncSession) -> FinanceGoalResponse:
    result = await session.execute(select(FinanceGoal))
    goal = result.scalar_one_or_none()
    target_amount = goal.target_amount if goal else None
    target_date = goal.target_date if goal else None
    rate = goal.expected_annual_return_rate if goal else 0.0

    latest_assets = await _get_latest_assets(session)
    today = date.today()
    progress_pct, months_remaining, required, achieved = compute_goal_projection(
        latest_assets, target_amount, target_date, rate, today
    )

    scenarios: list[GoalScenario] = []
    if target_amount is not None and target_date is not None and latest_assets is not None:
        for scenario_rate in SCENARIO_RATES:
            _, _, scenario_required, _ = compute_goal_projection(
                latest_assets, target_amount, target_date, scenario_rate, today
            )
            scenarios.append(GoalScenario(annual_return_rate=scenario_rate, required_monthly_saving=scenario_required))

    return FinanceGoalResponse(
        target_amount=target_amount,
        target_date=target_date,
        expected_annual_return_rate=rate,
        progress_pct=progress_pct,
        months_remaining=months_remaining,
        required_monthly_saving=required,
        achieved=achieved,
        scenarios=scenarios,
    )


async def update_goal(session: AsyncSession, data: FinanceGoalUpdate) -> FinanceGoalResponse:
    async with session.begin():
        result = await session.execute(select(FinanceGoal))
        goal = result.scalar_one_or_none()
        if goal is None:
            goal = FinanceGoal(id=1, **data.model_dump(exclude_unset=True))
            session.add(goal)
        else:
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(goal, field, value)
    return await get_goal(session)
