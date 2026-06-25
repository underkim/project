from datetime import date
from pydantic import BaseModel, field_validator


class ExerciseLogCreate(BaseModel):
    log_date: date
    exercise_type: str
    duration_minutes: int
    note: str | None = None

    @field_validator("exercise_type")
    @classmethod
    def exercise_type_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("운동 종류는 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("duration_minutes")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("운동 시간은 1분 이상이어야 합니다")
        return v


class ExerciseLogResponse(BaseModel):
    id: int
    log_date: date
    exercise_type: str
    duration_minutes: int
    note: str | None
    model_config = {"from_attributes": True}


class SleepLogCreate(BaseModel):
    log_date: date
    sleep_hours: float
    quality: int
    note: str | None = None

    @field_validator("quality")
    @classmethod
    def quality_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("수면 품질은 1~5 사이여야 합니다")
        return v

    @field_validator("sleep_hours")
    @classmethod
    def sleep_range(cls, v: float) -> float:
        if not 0 < v <= 24:
            raise ValueError("수면 시간은 0~24 사이여야 합니다")
        return v


class SleepLogResponse(BaseModel):
    id: int
    log_date: date
    sleep_hours: float
    quality: int
    note: str | None
    model_config = {"from_attributes": True}


class ExerciseLogUpdate(BaseModel):
    exercise_type: str | None = None
    duration_minutes: int | None = None
    note: str | None = None

    @field_validator("duration_minutes")
    @classmethod
    def must_be_positive(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("운동 시간은 1분 이상이어야 합니다")
        return v


class SleepLogUpdate(BaseModel):
    sleep_hours: float | None = None
    quality: int | None = None
    note: str | None = None

    @field_validator("quality")
    @classmethod
    def quality_range(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 5:
            raise ValueError("수면 품질은 1~5 사이여야 합니다")
        return v

    @field_validator("sleep_hours")
    @classmethod
    def sleep_range(cls, v: float | None) -> float | None:
        if v is not None and not 0 < v <= 24:
            raise ValueError("수면 시간은 0~24 사이여야 합니다")
        return v


class HealthSummaryResponse(BaseModel):
    exercise_days_this_week: int
    total_exercise_minutes_this_week: int
    avg_sleep_hours_this_week: float | None
    avg_sleep_quality_this_week: float | None
