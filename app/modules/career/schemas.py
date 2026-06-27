from datetime import date
from pydantic import BaseModel, field_validator


class CareerSettingsResponse(BaseModel):
    cf_handle: str | None
    github_username: str | None
    blog_url: str | None
    model_config = {"from_attributes": True}


class CareerSettingsUpdate(BaseModel):
    cf_handle: str | None = None
    github_username: str | None = None
    blog_url: str | None = None

    @field_validator("cf_handle", "github_username", "blog_url")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("값이 비어 있을 수 없습니다 (삭제하려면 null을 보내세요)")
        return v.strip() if v is not None else v


class CFRatingLogCreate(BaseModel):
    log_date: date
    rating: int
    rank_name: str

    @field_validator("rank_name")
    @classmethod
    def rank_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("랭크명은 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("rating")
    @classmethod
    def rating_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("레이팅은 0 이상이어야 합니다")
        return v


class CFRatingLogUpdate(BaseModel):
    log_date: date | None = None
    rating: int | None = None
    rank_name: str | None = None

    @field_validator("rating")
    @classmethod
    def rating_positive(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("레이팅은 0 이상이어야 합니다")
        return v


class CFRatingLogResponse(BaseModel):
    id: int
    log_date: date
    rating: int
    rank_name: str
    model_config = {"from_attributes": True}


class CareerSummaryResponse(BaseModel):
    cf_handle: str | None
    github_username: str | None
    latest_cf_rating: int | None
    latest_cf_rank: str | None
    peak_cf_rating: int | None = None
    rating_delta: int | None = None
