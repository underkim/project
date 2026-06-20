from datetime import date
from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BookRecord(Base):
    __tablename__ = "book_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    author: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")  # planned/reading/completed
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-5
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)


class EnglishLog(Base):
    __tablename__ = "english_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # reading/listening/speaking/writing/vocab
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
