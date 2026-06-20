from datetime import date
from pydantic import BaseModel, HttpUrl


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
