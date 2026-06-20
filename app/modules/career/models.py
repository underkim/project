from datetime import date
from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CareerSettings(Base):
    """CF·GitHub·블로그 프로필 설정 (단일 row, id=1 고정)."""
    __tablename__ = "career_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    cf_handle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blog_url: Mapped[str | None] = mapped_column(String(200), nullable=True)


class CFRatingLog(Base):
    """Codeforces 레이팅 기록 (수동 입력)."""
    __tablename__ = "cf_rating_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    rank_name: Mapped[str] = mapped_column(String(50), nullable=False)  # newbie, pupil, specialist...
