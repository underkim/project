import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.career import service as career_svc
from app.modules.dashboard.schemas import (
    CareerSnapshot,
    FinanceSnapshot,
    GrowthSnapshot,
    HealthSnapshot,
    OverviewMeta,
    OverviewResponse,
    PhaseProgress,
    PlannerSnapshot,
    TravelSnapshot,
    TrackerSnapshot,
)

logger = logging.getLogger(__name__)
from app.modules.finance import service as finance_svc
from app.modules.growth import service as growth_svc
from app.modules.health import service as health_svc
from app.modules.planner import service as planner_svc
from app.modules.planner.schemas import ItemStatus
from app.modules.travel import service as travel_svc
from app.modules.trackers import service as trackers_svc


async def _planner_snapshot(session: AsyncSession) -> PlannerSnapshot | None:
    try:
        roadmap = await planner_svc.get_roadmap(session)
        total = completed = urgent = overdue = 0
        phase_progress: list[PhaseProgress] = []
        for phase in roadmap.phases:
            p_total = p_completed = 0
            for category in phase.categories:
                for item in category.items:
                    total += 1
                    p_total += 1
                    if item.status == ItemStatus.completed:
                        completed += 1
                        p_completed += 1
                    elif item.status == ItemStatus.urgent:
                        urgent += 1
                    elif item.status == ItemStatus.overdue:
                        overdue += 1
            phase_progress.append(PhaseProgress(
                name=phase.name,
                label=phase.label,
                color=phase.color,
                total=p_total,
                completed=p_completed,
                is_current=phase.is_current,
            ))
        return PlannerSnapshot(
            start_date=roadmap.start_date,
            total_items=total,
            completed_items=completed,
            urgent_items=urgent,
            overdue_items=overdue,
            phases=phase_progress,
        )
    except Exception:
        return None


async def _finance_snapshot(session: AsyncSession) -> FinanceSnapshot | None:
    try:
        summary = await finance_svc.get_summary(session, records_limit=0)
        goal = await finance_svc.get_goal(session)
        return FinanceSnapshot(
            latest_total_assets=summary.latest_total_assets,
            avg_savings_rate=summary.avg_savings_rate,
            asset_change=summary.asset_change,
            goal_target_amount=goal.target_amount,
            goal_progress_pct=goal.progress_pct,
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
            exercise_streak=summary.exercise_streak,
        )
    except Exception:
        return None


async def _growth_snapshot(session: AsyncSession) -> GrowthSnapshot | None:
    try:
        summary = await growth_svc.get_summary(session)
        return GrowthSnapshot(
            books_completed_this_year=summary.books_completed_this_year,
            books_reading=summary.books_reading,
            books_wishlist=summary.books_wishlist,
            english_days_this_month=summary.english_days_this_month,
            english_minutes_this_month=summary.english_minutes_this_month,
            english_streak=summary.english_streak,
        )
    except Exception:
        return None


async def _career_snapshot(session: AsyncSession) -> CareerSnapshot | None:
    try:
        summary = await career_svc.get_summary(session)
        return CareerSnapshot(
            cf_handle=summary.cf_handle,
            latest_cf_rating=summary.latest_cf_rating,
            latest_cf_rank=summary.latest_cf_rank,
            rating_delta=summary.rating_delta,
        )
    except Exception:
        return None


async def _travel_snapshot(session: AsyncSession) -> TravelSnapshot | None:
    try:
        summary = await travel_svc.get_summary(session)
        next_trip = await travel_svc.get_next_trip(session)
        checklist = next_trip.checklist_items if next_trip else []
        plan_items = next_trip.plan_items if next_trip else []
        return TravelSnapshot(
            total=summary.total,
            upcoming=summary.planned,
            ongoing=summary.ongoing,
            next_trip_name=next_trip.name if next_trip else None,
            next_trip_destination=next_trip.destination if next_trip else None,
            next_trip_start_date=next_trip.start_date if next_trip else None,
            next_trip_checklist_total=len(checklist),
            next_trip_checklist_done=sum(1 for item in checklist if item.is_checked),
            next_trip_plan_total=len(plan_items),
        )
    except Exception:
        return None


async def _trackers_snapshot(session: AsyncSession) -> TrackerSnapshot | None:
    try:
        summary = await trackers_svc.get_summary(session)
        return TrackerSnapshot(
            active_trackers=summary.active_trackers,
            entries_this_week=summary.entries_this_week,
        )
    except Exception:
        return None


async def get_overview(session: AsyncSession) -> OverviewResponse:
    # ADR-0002: 한 모듈 실패해도 나머지 응답 반환.
    # 요청당 세션은 1개뿐이라(core/database.py get_db) 여러 모듈을 asyncio.gather로 동시에
    # 조회하면 하나의 AsyncSession을 여러 코루틴이 동시에 사용하게 되어 위험하다
    # (SQLAlchemy AsyncSession은 동시 사용을 지원하지 않음). 순차 실행으로 안전하게 처리한다.
    _MODULES = ["planner", "finance", "health", "growth", "career", "travel", "trackers"]
    _SNAPSHOT_FNS = [
        _planner_snapshot, _finance_snapshot, _health_snapshot,
        _growth_snapshot, _career_snapshot, _travel_snapshot, _trackers_snapshot,
    ]

    failed_modules: list[str] = []
    snapshots: list = []
    for module_name, snapshot_fn in zip(_MODULES, _SNAPSHOT_FNS):
        try:
            result = await snapshot_fn(session)
        except Exception as exc:
            logger.error(
                "dashboard snapshot failed: module=%s error_type=%s",
                module_name, type(exc).__name__,
            )
            failed_modules.append(module_name)
            snapshots.append(None)
            continue
        if result is None:
            failed_modules.append(module_name)
            snapshots.append(None)
        else:
            snapshots.append(result)

    return OverviewResponse(
        planner=snapshots[0],
        finance=snapshots[1],
        health=snapshots[2],
        growth=snapshots[3],
        career=snapshots[4],
        travel=snapshots[5],
        trackers=snapshots[6],
        meta=OverviewMeta(
            partial_failure=len(failed_modules) > 0,
            failed_modules=failed_modules,
        ),
    )
