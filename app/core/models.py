from datetime import date
from sqlalchemy import ForeignKey, String, Integer, Boolean, Float, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Phase(Base):
    __tablename__ = "phases"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(100))
    order_index: Mapped[int] = mapped_column(Integer)
    months: Mapped[int] = mapped_column(Integer)
    color: Mapped[str] = mapped_column(String(20))

    categories: Mapped[list["Category"]] = relationship(
        back_populates="phase", order_by="Category.order_index", cascade="all, delete-orphan",
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    phase_id: Mapped[int] = mapped_column(ForeignKey("phases.id"))
    icon: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(50))
    subtitle: Mapped[str] = mapped_column(String(100))
    order_index: Mapped[int] = mapped_column(Integer)

    phase: Mapped["Phase"] = relationship(back_populates="categories")
    items: Mapped[list["RoadmapItem"]] = relationship(
        back_populates="category", order_by="RoadmapItem.offset",cascade="all, delete-orphan",
    )


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    text: Mapped[str] = mapped_column(String(200))
    offset: Mapped[float] = mapped_column(Float)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped["Category"] = relationship(back_populates="items")


class RoadmapSettings(Base):
    __tablename__ = "roadmap_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)