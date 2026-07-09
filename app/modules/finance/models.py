from datetime import date
from sqlalchemy import Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetRecord(Base):
    """월별 자산 스냅샷. record_date는 해당 월의 첫째 날 기준."""
    __tablename__ = "asset_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    record_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    total_assets: Mapped[int] = mapped_column(Integer, nullable=False)   # 만원
    monthly_income: Mapped[int] = mapped_column(Integer, nullable=False)  # 만원
    monthly_expense: Mapped[int] = mapped_column(Integer, nullable=False) # 만원
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)


class FinanceGoal(Base):
    """자산 목표 설정 (단일 row, id=1 고정)."""
    __tablename__ = "finance_goal"

    id: Mapped[int] = mapped_column(primary_key=True)
    target_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 만원
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_annual_return_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # %
