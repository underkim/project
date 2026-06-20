from datetime import date
from enum import Enum

from pydantic import BaseModel, computed_field


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


class RoadmapItemUpdate(BaseModel):
    text: str | None = None
    offset: float | None = None


class PhaseUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    months: int | None = None
    color: str | None = None


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
