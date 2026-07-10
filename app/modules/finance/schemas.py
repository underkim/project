from datetime import date
from pydantic import BaseModel, field_validator


class AssetRecordCreate(BaseModel):
    record_date: date
    total_assets: int
    monthly_income: int
    monthly_expense: int
    note: str | None = None

    @field_validator("total_assets", "monthly_income", "monthly_expense")
    @classmethod
    def must_be_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("금액은 0 이상이어야 합니다")
        return v


class AssetRecordUpdate(BaseModel):
    record_date: date | None = None
    total_assets: int | None = None
    monthly_income: int | None = None
    monthly_expense: int | None = None
    note: str | None = None

    @field_validator("total_assets", "monthly_income", "monthly_expense")
    @classmethod
    def must_be_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("금액은 0 이상이어야 합니다")
        return v


class AssetRecordResponse(BaseModel):
    id: int
    record_date: date
    total_assets: int
    monthly_income: int
    monthly_expense: int
    savings_amount: int
    savings_rate: float | None  # income 0이면 None
    note: str | None

    model_config = {"from_attributes": True}


class FinanceSummaryResponse(BaseModel):
    latest_total_assets: int | None
    avg_savings_rate: float | None  # 최근 3개월 평균
    asset_change: int | None = None  # 직전 기록 대비 자산 증감
    latest_record_date: date | None = None  # 최신 기록의 날짜 (stale 여부 판단용)
    records: list[AssetRecordResponse]


class FinanceGoalUpdate(BaseModel):
    target_amount: int | None = None
    target_date: date | None = None
    expected_annual_return_rate: float | None = None

    @field_validator("target_amount")
    @classmethod
    def target_amount_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("목표 금액은 0보다 커야 합니다")
        return v

    @field_validator("expected_annual_return_rate")
    @classmethod
    def rate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("예상 수익률은 0 이상이어야 합니다")
        return v


class GoalScenario(BaseModel):
    annual_return_rate: float
    required_monthly_saving: int  # 만원


class FinanceGoalResponse(BaseModel):
    target_amount: int | None
    target_date: date | None
    expected_annual_return_rate: float
    # 아래는 최신 자산 기록 기준 파생값 (목표 미설정 시 전부 None)
    progress_pct: float | None = None
    months_remaining: int | None = None
    required_monthly_saving: int | None = None  # 만원, 예상 수익률 반영
    achieved: bool = False
    # 수익률별 필요 월 저축액 비교 (목표 미설정 시 빈 배열) — "저축만" vs "투자 시" 비교용
    scenarios: list[GoalScenario] = []

    model_config = {"from_attributes": True}
