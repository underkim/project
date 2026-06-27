import re
from datetime import date
from pydantic import BaseModel, field_validator

_CF_HANDLE_RE = re.compile(r'^[\w\-]{1,24}$')
_GITHUB_USERNAME_RE = re.compile(r'^[a-zA-Z0-9](?:[a-zA-Z0-9_\-]{0,37}[a-zA-Z0-9])?$')
_SAFE_URL_RE = re.compile(r'^https?://', re.IGNORECASE)


class CareerSettingsResponse(BaseModel):
    cf_handle: str | None
    github_username: str | None
    blog_url: str | None
    model_config = {"from_attributes": True}


class CareerSettingsUpdate(BaseModel):
    cf_handle: str | None = None
    github_username: str | None = None
    blog_url: str | None = None

    @field_validator("cf_handle")
    @classmethod
    def validate_cf_handle(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("값이 비어 있을 수 없습니다 (삭제하려면 null을 보내세요)")
        if not _CF_HANDLE_RE.match(v):
            raise ValueError("Codeforces 핸들에는 공백, 슬래시 등의 특수문자를 사용할 수 없습니다")
        return v

    @field_validator("github_username")
    @classmethod
    def validate_github_username(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("값이 비어 있을 수 없습니다 (삭제하려면 null을 보내세요)")
        if not _GITHUB_USERNAME_RE.match(v):
            raise ValueError("GitHub 사용자명은 영문, 숫자, 하이픈만 사용할 수 있습니다")
        return v

    @field_validator("blog_url")
    @classmethod
    def validate_blog_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("값이 비어 있을 수 없습니다 (삭제하려면 null을 보내세요)")
        if not _SAFE_URL_RE.match(v):
            raise ValueError("블로그 URL은 http:// 또는 https://로 시작해야 합니다")
        return v


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
