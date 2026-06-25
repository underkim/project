from datetime import date
from enum import Enum

from pydantic import BaseModel, computed_field, field_validator


class ItemStatus(str, Enum):
    completed = "completed"
    urgent = "urgent"      # deadline <= 오늘 + 30일
    on_track = "on_track"
    overdue = "overdue"


class RoadmapItemResponse(BaseModel):
    id: int
    text: str
    offset: float
    is_completed: bool
    deadline: date | None = None
    status: ItemStatus | None = None

    model_config = {"from_attributes": True}


class CategoryResponse(BaseModel):
    id: int
    icon: str
    title: str
    subtitle: str
    order_index: int
    items: list[RoadmapItemResponse] = []

    model_config = {"from_attributes": True}


class PhaseResponse(BaseModel):
    id: int
    name: str
    label: str
    order_index: int
    months: int
    color: str
    start_date: date | None = None
    categories: list[CategoryResponse] = []

    model_config = {"from_attributes": True}


class RoadmapResponse(BaseModel):
    start_date: date | None
    phases: list[PhaseResponse]


class SettingsResponse(BaseModel):
    start_date: date | None


class SettingsUpdate(BaseModel):
    start_date: date | None


class ItemToggleResponse(BaseModel):
    id: int
    is_completed: bool


class RoadmapItemCreate(BaseModel):
    category_id: int
    text: str
    offset: float = 0.0

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("플래너 항목은 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("offset")
    @classmethod
    def offset_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("offset은 0 이상이어야 합니다")
        return v


class RoadmapItemUpdate(BaseModel):
    text: str | None = None
    offset: float | None = None


class PhaseUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    months: int | None = None
    color: str | None = None

    @field_validator("months")
    @classmethod
    def months_positive(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Phase 기간은 1개월 이상이어야 합니다")
        return v


class PhaseUpdateResponse(BaseModel):
    id: int
    name: str
    label: str
    months: int
    color: str


class CategoryCreate(BaseModel):
    phase_id: int
    icon: str = "📌"
    title: str
    subtitle: str = ""

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("카테고리 제목은 비어 있을 수 없습니다")
        return v.strip()


class CategoryUpdate(BaseModel):
    icon: str | None = None
    title: str | None = None
    subtitle: str | None = None


class CategoryUpdateResponse(BaseModel):
    id: int
    icon: str
    title: str
    subtitle: str
    order_index: int
