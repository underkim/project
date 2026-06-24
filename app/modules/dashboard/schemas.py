from datetime import date
from pydantic import BaseModel


class PlannerSnapshot(BaseModel):
    start_date: date | None
    total_items: int
    completed_items: int
    urgent_items: int   # deadline <= 오늘 + 30일, 미완료
    overdue_items: int


class FinanceSnapshot(BaseModel):
    latest_total_assets: int | None
    avg_savings_rate: float | None


class HealthSnapshot(BaseModel):
    exercise_days_this_week: int
    total_exercise_minutes_this_week: int
    avg_sleep_hours_this_week: float | None
    avg_sleep_quality_this_week: float | None


class GrowthSnapshot(BaseModel):
    books_completed_this_year: int
    books_reading: int
    english_days_this_month: int
    english_minutes_this_month: int


class CareerSnapshot(BaseModel):
    cf_handle: str | None
    latest_cf_rating: int | None
    latest_cf_rank: str | None


class TravelSnapshot(BaseModel):
    total: int
    upcoming: int
    ongoing: int
    next_trip_name: str | None
    next_trip_destination: str | None


class OverviewResponse(BaseModel):
    planner: PlannerSnapshot | None
    finance: FinanceSnapshot | None
    health: HealthSnapshot | None
    growth: GrowthSnapshot | None
    career: CareerSnapshot | None
    travel: TravelSnapshot | None
