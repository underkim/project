from datetime import date
from typing import Literal
from pydantic import BaseModel, field_validator, model_validator

TripStatus = Literal["planned", "ongoing", "completed"]


def _validate_lat(v: float | None) -> float | None:
    if v is not None and not -90 <= v <= 90:
        raise ValueError("위도는 -90 ~ 90 사이여야 합니다")
    return v


def _validate_lng(v: float | None) -> float | None:
    if v is not None and not -180 <= v <= 180:
        raise ValueError("경도는 -180 ~ 180 사이여야 합니다")
    return v


def _trim_or_none(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


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
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    @field_validator("name", "destination")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("여행명과 목적지는 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("address")
    @classmethod
    def trim_address(cls, v: str | None) -> str | None:
        return _trim_or_none(v)

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, v: float | None) -> float | None:
        return _validate_lat(v)

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, v: float | None) -> float | None:
        return _validate_lng(v)

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
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    @field_validator("name", "destination")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("여행명과 목적지는 비어 있을 수 없습니다")
        return v.strip() if v is not None else v

    @field_validator("address")
    @classmethod
    def trim_address(cls, v: str | None) -> str | None:
        return _trim_or_none(v)

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, v: float | None) -> float | None:
        return _validate_lat(v)

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, v: float | None) -> float | None:
        return _validate_lng(v)

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


class PlanItemUpdate(BaseModel):
    title: str | None = None
    time: str | None = None
    description: str | None = None
    day: int | None = None


class PlanItemResponse(BaseModel):
    id: int
    day: int
    sort_order: int
    time: str | None
    title: str
    description: str | None

    model_config = {"from_attributes": True}


class RestaurantCreate(BaseModel):
    name: str
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cuisine: str | None = None
    note: str | None = None
    is_visited: bool = False
    order_index: int = 0

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("맛집 이름은 비어 있을 수 없습니다")
        return v.strip()

    @field_validator("address", "cuisine", "note")
    @classmethod
    def trim_text(cls, v: str | None) -> str | None:
        return _trim_or_none(v)

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, v: float | None) -> float | None:
        return _validate_lat(v)

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, v: float | None) -> float | None:
        return _validate_lng(v)


class RestaurantUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    cuisine: str | None = None
    note: str | None = None
    is_visited: bool | None = None
    order_index: int | None = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("맛집 이름은 비어 있을 수 없습니다")
        return v.strip() if v is not None else v

    @field_validator("address", "cuisine", "note")
    @classmethod
    def trim_text(cls, v: str | None) -> str | None:
        return _trim_or_none(v)

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, v: float | None) -> float | None:
        return _validate_lat(v)

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, v: float | None) -> float | None:
        return _validate_lng(v)


class RestaurantResponse(BaseModel):
    id: int
    name: str
    address: str | None
    latitude: float | None
    longitude: float | None
    cuisine: str | None
    note: str | None
    is_visited: bool
    order_index: int

    model_config = {"from_attributes": True}


class TripResponse(BaseModel):
    id: int
    name: str
    destination: str
    start_date: date
    end_date: date
    status: str
    note: str | None
    address: str | None
    latitude: float | None
    longitude: float | None
    checklist_items: list[ChecklistItemResponse]
    plan_items: list[PlanItemResponse]
    restaurants: list[RestaurantResponse]

    model_config = {"from_attributes": True}


class TravelSummaryResponse(BaseModel):
    total: int
    planned: int
    ongoing: int
    completed: int
