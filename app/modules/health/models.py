from datetime import date
from sqlalchemy import Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    exercise_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 러닝, 헬스, 수영 등
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)


class SleepLog(Base):
    __tablename__ = "sleep_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    sleep_hours: Mapped[float] = mapped_column(Float, nullable=False)
    quality: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5점
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
