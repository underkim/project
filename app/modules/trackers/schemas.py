from datetime import date, datetime
from enum import Enum
import math

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TrackerValueType(str, Enum):
    number = "number"
    text = "text"
    checkbox = "checkbox"


class TrackerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=240)
    value_type: TrackerValueType
    unit: str | None = Field(default=None, max_length=20)
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("이름을 입력해주세요.")
        return value

    @field_validator("description", "unit")
    @classmethod
    def clean_optional(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class TrackerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=240)
    unit: str | None = Field(default=None, max_length=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    is_archived: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("이름을 입력해주세요.")
        return value


class EntryCreate(BaseModel):
    entry_date: date
    value: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=500)


class EntryUpdate(BaseModel):
    entry_date: date | None = None
    value: str | None = Field(default=None, min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=500)


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tracker_id: int
    entry_date: date
    value: str
    note: str | None
    created_at: datetime


class TrackerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    value_type: TrackerValueType
    unit: str | None
    color: str
    is_archived: bool
    created_at: datetime


class TrackerDetail(TrackerResponse):
    entries: list[EntryResponse]


class TrackerSummary(BaseModel):
    active_trackers: int
    entries_this_week: int
    recent_entries: list[EntryResponse]


def normalize_value(value_type: str, raw_value: str) -> str:
    value = raw_value.strip()
    if value_type == TrackerValueType.number.value:
        try:
            number = float(value)
        except ValueError as exc:
            raise ValueError("숫자 형식의 값을 입력해주세요.") from exc
        if not math.isfinite(number):
            raise ValueError("유효한 숫자를 입력해주세요.")
        return str(number).rstrip("0").rstrip(".") if "." in str(number) else str(number)
    if value_type == TrackerValueType.checkbox.value:
        lowered = value.lower()
        if lowered not in {"true", "false"}:
            raise ValueError("완료 여부는 true 또는 false여야 합니다.")
        return lowered
    if not value:
        raise ValueError("값을 입력해주세요.")
    return value
