from datetime import date
from typing import Literal
from pydantic import BaseModel, field_validator, model_validator

TripStatus = Literal["planned", "ongoing", "completed"]


class ChecklistItemCreate(BaseModel):
    text: str
    order_index: int = 0

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("체크리스트 항목은 비어 있을 수 없습니다")
        return v.strip()


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

    @field_validator("name", "destination")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("여행명과 목적지는 비어 있을 수 없습니다")
        return v.strip()

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

    @field_validator("name", "destination")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("여행명과 목적지는 비어 있을 수 없습니다")
        return v.strip() if v is not None else v

    @model_validator(mode="after")
    def end_after_start(self) -> "TripUpdate":
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("종료일은 시작일 이후여야 합니다")
        return self


class PlanItemCreate(BaseModel):
    day: int = 1
    sort_order: int = 0
    time: str | None = None
    title: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("일정 제목은 비어 있을 수 없습니다")
        return v.strip()

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
