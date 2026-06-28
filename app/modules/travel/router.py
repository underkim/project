from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.travel import service
from app.modules.travel.schemas import (
    ChecklistItemCreate,
    ChecklistItemResponse,
    PlanItemCreate,
    PlanItemResponse,
    PlanItemUpdate,
    TravelSummaryResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
)

router = APIRouter(prefix="/api/v1/travel", tags=["travel"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=TravelSummaryResponse)
async def get_summary(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/trips", response_model=list[TripResponse])
async def list_trips(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.list_trips(session)


@router.get("/trips/{trip_id}", response_model=TripResponse)
async def get_trip(trip_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    result = await service.get_trip(session, trip_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 기록을 찾을 수 없습니다.")
    return result


@router.post("/trips", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    return await service.create_trip(session, data)


@router.put("/trips/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: int,
    data: TripUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        result = await service.update_trip(session, trip_id, data)
    except ValueError:
        raise HTTPException(status_code=422, detail="종료일은 시작일 이후여야 합니다.")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 기록을 찾을 수 없습니다.")
    return result


@router.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: int,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_trip(session, trip_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 기록을 찾을 수 없습니다.")


@router.post(
    "/trips/{trip_id}/checklist",
    response_model=ChecklistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_checklist_item(
    trip_id: int,
    data: ChecklistItemCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.add_checklist_item(session, trip_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 기록을 찾을 수 없습니다.")
    return result


@router.patch("/checklist/{item_id}/toggle", response_model=ChecklistItemResponse)
async def toggle_checklist_item(
    item_id: int,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.toggle_checklist_item(session, item_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="체크리스트 항목을 찾을 수 없습니다.")
    return result


@router.delete("/checklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist_item(
    item_id: int,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_checklist_item(session, item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="체크리스트 항목을 찾을 수 없습니다.")


@router.post(
    "/trips/{trip_id}/plan",
    response_model=PlanItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_plan_item(
    trip_id: int,
    data: PlanItemCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.add_plan_item(session, trip_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="여행 기록을 찾을 수 없습니다.")
    return result


@router.put("/plan/{item_id}", response_model=PlanItemResponse)
async def update_plan_item(
    item_id: int,
    data: PlanItemUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.update_plan_item(session, item_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="일정 항목을 찾을 수 없습니다.")
    return result


@router.delete("/plan/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan_item(
    item_id: int,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_plan_item(session, item_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="일정 항목을 찾을 수 없습니다.")
