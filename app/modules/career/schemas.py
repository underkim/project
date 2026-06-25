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


class CFRatingLogCreate(BaseModel):
    log_date: date
    rating: int
    rank_name: str

    @field_validator("rating")
    @classmethod
    def rating_positive(cls, v: int) -> int:
        if v < 0:
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
