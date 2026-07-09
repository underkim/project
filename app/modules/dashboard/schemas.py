from datetime import date
from pydantic import BaseModel


class PhaseProgress(BaseModel):
    name: str
    label: str
    color: str
    total: int
    completed: int
    is_current: bool


class PlannerSnapshot(BaseModel):
    start_date: date | None
    total_items: int
    completed_items: int
    urgent_items: int   # deadline <= 오늘 + 30일, 미완료
    overdue_items: int
    phases: list[PhaseProgress]


class FinanceSnapshot(BaseModel):
    latest_total_assets: int | None
    avg_savings_rate: float | None
    asset_change: int | None = None
    goal_target_amount: int | None = None
    goal_progress_pct: float | None = None


class HealthSnapshot(BaseModel):
    exercise_days_this_week: int
    total_exercise_minutes_this_week: int
    avg_sleep_hours_this_week: float | None
    avg_sleep_quality_this_week: float | None
    exercise_streak: int = 0


class GrowthSnapshot(BaseModel):
    books_completed_this_year: int
    books_reading: int
    books_wishlist: int = 0
    english_days_this_month: int
    english_minutes_this_month: int
    english_streak: int = 0


class CareerSnapshot(BaseModel):
    cf_handle: str | None
    latest_cf_rating: int | None
    latest_cf_rank: str | None
    rating_delta: int | None = None


class TravelSnapshot(BaseModel):
    total: int
    upcoming: int
    ongoing: int
    next_trip_name: str | None
    next_trip_destination: str | None
    next_trip_start_date: date | None
    next_trip_checklist_total: int = 0
    next_trip_checklist_done: int = 0
    next_trip_plan_total: int = 0


class OverviewMeta(BaseModel):
    partial_failure: bool
    failed_modules: list[str]


class OverviewResponse(BaseModel):
    planner: PlannerSnapshot | None
    finance: FinanceSnapshot | None
    health: HealthSnapshot | None
    growth: GrowthSnapshot | None
    career: CareerSnapshot | None
    travel: TravelSnapshot | None
    meta: OverviewMeta
