from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Tracker(Base):
    __tablename__ = "trackers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str | None] = mapped_column(String(240))
    value_type: Mapped[str] = mapped_column(String(16), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(20))
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#6366f1")
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    entries: Mapped[list["TrackerEntry"]] = relationship(
        back_populates="tracker", cascade="all, delete-orphan", passive_deletes=True
    )


class TrackerEntry(Base):
    __tablename__ = "tracker_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracker_id: Mapped[int] = mapped_column(
        ForeignKey("trackers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    tracker: Mapped[Tracker] = relationship(back_populates="entries")
