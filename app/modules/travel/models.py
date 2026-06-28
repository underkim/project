from datetime import date
from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 지도 표시용 (선택) — 주소 입력 시 지오코딩으로 좌표 보강
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    checklist_items: Mapped[list["TripChecklistItem"]] = relationship(
        "TripChecklistItem",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripChecklistItem.order_index",
        passive_deletes=True,
    )
    plan_items: Mapped[list["TripPlanItem"]] = relationship(
        "TripPlanItem",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="(TripPlanItem.day, TripPlanItem.sort_order)",
        passive_deletes=True,
    )
    restaurants: Mapped[list["TripRestaurant"]] = relationship(
        "TripRestaurant",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="(TripRestaurant.order_index, TripRestaurant.id)",
        passive_deletes=True,
    )


class TripChecklistItem(Base):
    __tablename__ = "trip_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(String(200), nullable=False)
    is_checked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    trip: Mapped["Trip"] = relationship("Trip", back_populates="checklist_items")


class TripPlanItem(Base):
    __tablename__ = "trip_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    time: Mapped[str | None] = mapped_column(String(10), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    trip: Mapped["Trip"] = relationship("Trip", back_populates="plan_items")


class TripRestaurant(Base):
    __tablename__ = "trip_restaurants"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    cuisine: Mapped[str | None] = mapped_column(String(50), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_visited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    trip: Mapped["Trip"] = relationship("Trip", back_populates="restaurants")
