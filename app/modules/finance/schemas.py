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
    records: list[AssetRecordResponse]
