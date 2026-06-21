import asyncio
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.career import service as career_svc
from app.modules.dashboard.schemas import (
    CareerSnapshot,
    FinanceSnapshot,
    GrowthSnapshot,
    HealthSnapshot,
    OverviewResponse,
    PlannerSnapshot,
    TravelSnapshot,
)
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.health import service as health_svc
from app.modules.planner import service as planner_svc
from app.modules.planner.schemas import ItemStatus
from app.modules.travel import service as travel_svc


async def _planner_snapshot(session: AsyncSession) -> PlannerSnapshot | None:
    try:
        roadmap = await planner_svc.get_roadmap(session)
        today = date.today()
        total = completed = urgent = overdue = 0
        for phase in roadmap.phases:
            for category in phase.categories:
                for item in category.items:
                    total += 1
                    if item.status == ItemStatus.completed:
                        completed += 1
                    elif item.status == ItemStatus.urgent:
                        urgent += 1
                    elif item.status == ItemStatus.overdue:
                        overdue += 1
        return PlannerSnapshot(
            start_date=roadmap.start_date,
            total_items=total,
            completed_items=completed,
            urgent_items=urgent,
            overdue_items=overdue,
        )
    except Exception:
        return None


async def _finance_snapshot(session: AsyncSession) -> FinanceSnapshot | None:
    try:
        summary = await finance_svc.get_summary(session)
        return FinanceSnapshot(
            latest_total_assets=summary.latest_total_assets,
            avg_savings_rate=summary.avg_savings_rate,
        )
    except Exception:
        return None


async def _health_snapshot(session: AsyncSession) -> HealthSnapshot | None:
    try:
        summary = await health_svc.get_summary(session)
        return HealthSnapshot(
            exercise_days_this_week=summary.exercise_days_this_week,
            total_exercise_minutes_this_week=summary.total_exercise_minutes_this_week,
            avg_sleep_hours_this_week=summary.avg_sleep_hours_this_week,
            avg_sleep_quality_this_week=summary.avg_sleep_quality_this_week,
        )
    except Exception:
        return None


async def _growth_snapshot(session: AsyncSession) -> GrowthSnapshot | None:
    try:
        summary = await growth_svc.get_summary(session)
        return GrowthSnapshot(
            books_completed_this_year=summary.books_completed_this_year,
            books_reading=summary.books_reading,
            english_days_this_month=summary.english_days_this_month,
            english_minutes_this_month=summary.english_minutes_this_month,
        )
    except Exception:
        return None


async def _career_snapshot(session: AsyncSession) -> CareerSnapshot | None:
    try:
        summary = await career_svc.get_summary(session)
        return CareerSnapshot(
            cf_handle=summary.cf_handle,
            latest_cf_rating=summary.latest_cf_rating,
        )
    except Exception:
        return None


async def _travel_snapshot(session: AsyncSession) -> TravelSnapshot | None:
    try:
        trips = await travel_svc.list_trips(session)
        upcoming = [t for t in trips if t.status == "planned"]
        ongoing = [t for t in trips if t.status == "ongoing"]
        next_trip = ongoing[0] if ongoing else (upcoming[0] if upcoming else None)
        return TravelSnapshot(
            total=len(trips),
            upcoming=len(upcoming),
            ongoing=len(ongoing),
            next_trip_name=next_trip.name if next_trip else None,
            next_trip_destination=next_trip.destination if next_trip else None,
        )
    except Exception:
        return None


async def get_overview(session: AsyncSession) -> OverviewResponse:
    # ADR-0002: 한 모듈 실패해도 나머지 응답 반환
    results = await asyncio.gather(
        _planner_snapshot(session),
        _finance_snapshot(session),
        _health_snapshot(session),
        _growth_snapshot(session),
        _career_snapshot(session),
        _travel_snapshot(session),
        return_exceptions=True,
    )

    def safe(v):
        return None if isinstance(v, Exception) else v

    return OverviewResponse(
        planner=safe(results[0]),
        finance=safe(results[1]),
        health=safe(results[2]),
        growth=safe(results[3]),
        career=safe(results[4]),
        travel=safe(results[5]),
    )
