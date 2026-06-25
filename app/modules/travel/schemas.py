from datetime import date
from typing import Literal
from pydantic import BaseModel, field_validator

TripStatus = Literal["planned", "ongoing", "completed"]


class ChecklistItemCreate(BaseModel):
    text: str
    order_index: int = 0


class ChecklistItemResponse(BaseModel):
    id: int
    text: str
    is_checked: bool
    order_index: int

    model_config = {"from_attributes": True}


class TripCreate(BaseModel):
    name: str
    destination: str
    start_date: date
    end_date: date
    status: TripStatus = "planned"
    note: str | None = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("종료일은 시작일 이후여야 합니다")
        return v


class TripUpdate(BaseModel):
    name: str | None = None
    destination: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: TripStatus | None = None
    note: str | None = None


class PlanItemCreate(BaseModel):
    day: int = 1
    sort_order: int = 0
    time: str | None = None
    title: str
    description: str | None = None

    @field_validator("day")
    @classmethod
    def day_must_be_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("일정 Day는 1 이상이어야 합니다")
        return v


class PlanItemResponse(BaseModel):
    id: int
    day: int
    sort_order: int
    time: str | None
    title: str
    description: str | None

    model_config = {"from_attributes": True}


class TripResponse(BaseModel):
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    status: str
    note: str | None
    checklist_items: list[ChecklistItemResponse]
    plan_items: list[PlanItemResponse]

    model_config = {"from_attributes": True}


class TravelSummaryResponse(BaseModel):
    total: int
    planned: int
    ongoing: int
    completed: int
