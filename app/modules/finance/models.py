from datetime import date
from sqlalchemy import Date, Integer, String
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
