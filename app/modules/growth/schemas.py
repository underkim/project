from datetime import date
from enum import Enum
from pydantic import BaseModel, field_validator, model_validator


class BookStatus(str, Enum):
    planned = "planned"
    reading = "reading"
    completed = "completed"


class BookRecordCreate(BaseModel):
    title: str
    author: str | None = None
    status: BookStatus = BookStatus.planned
    start_date: date | None = None
    end_date: date | None = None
    rating: int | None = None
    note: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("도서 제목은 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 5:
            raise ValueError("평점은 1~5 사이여야 합니다")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "BookRecordCreate":
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("완료일은 시작일 이후여야 합니다")
        return self


class BookRecordUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    status: BookStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    rating: int | None = None
    note: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("도서 제목은 비어 있을 수 없습니다")
        return v.strip() if v is not None else v

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 5:
            raise ValueError("평점은 1~5 사이여야 합니다")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "BookRecordUpdate":
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("완료일은 시작일 이후여야 합니다")
        return self


class BookRecordResponse(BaseModel):
    id: int
    title: str
    author: str | None
    status: BookStatus
    start_date: date | None
    end_date: date | None
    rating: int | None
    note: str | None
    model_config = {"from_attributes": True}


class EnglishLogCreate(BaseModel):
    log_date: date
    activity_type: str
    duration_minutes: int
    note: str | None = None

    @field_validator("activity_type")
    @classmethod
    def activity_type_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("활동 종류는 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("duration_minutes")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("학습 시간은 1분 이상이어야 합니다")
        return v


class EnglishLogResponse(BaseModel):
    id: int
    log_date: date
    activity_type: str
    duration_minutes: int
    note: str | None
    model_config = {"from_attributes": True}


class EnglishLogUpdate(BaseModel):
    activity_type: str | None = None
    duration_minutes: int | None = None
    note: str | None = None

    @field_validator("activity_type")
    @classmethod
    def activity_type_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("활동 종류는 비어 있을 수 없습니다")
        return v.strip() if v is not None else v

    @field_validator("duration_minutes")
    @classmethod
    def must_be_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("학습 시간은 1분 이상이어야 합니다")
        return v


class GrowthSummaryResponse(BaseModel):
    books_completed_this_year: int
    books_reading: int
    english_days_this_month: int
    english_minutes_this_month: int
