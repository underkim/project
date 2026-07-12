from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.trackers import service
from app.modules.trackers.schemas import (
    EntryCreate, EntryResponse, EntryUpdate, TrackerCreate, TrackerDetail,
    TrackerResponse, TrackerSummary, TrackerUpdate,
)

router = APIRouter(prefix="/api/v1/trackers", tags=["trackers"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("", response_model=list[TrackerResponse])
async def list_trackers(_: CurrentUser, session: AsyncSession = Depends(get_db), include_archived: bool = False):
    return await service.list_trackers(session, include_archived)


@router.get("/summary", response_model=TrackerSummary)
async def get_summary(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/{tracker_id}", response_model=TrackerDetail)
async def get_tracker(tracker_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db), limit: int = Query(50, ge=1, le=200)):
    result = await service.get_tracker(session, tracker_id, limit)
    if result is None:
        raise HTTPException(status_code=404, detail="추적 항목을 찾을 수 없습니다.")
    return result


@router.post("", response_model=TrackerResponse, status_code=status.HTTP_201_CREATED)
async def create_tracker(data: TrackerCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.create_tracker(session, data)


@router.put("/{tracker_id}", response_model=TrackerResponse)
async def update_tracker(tracker_id: int, data: TrackerUpdate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    result = await service.update_tracker(session, tracker_id, data)
    if result is None:
        raise HTTPException(status_code=404, detail="추적 항목을 찾을 수 없습니다.")
    return result


@router.delete("/{tracker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tracker(tracker_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_tracker(session, tracker_id):
        raise HTTPException(status_code=404, detail="추적 항목을 찾을 수 없습니다.")


@router.post("/{tracker_id}/entries", response_model=EntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(tracker_id: int, data: EntryCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    try:
        result = await service.create_entry(session, tracker_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="추적 항목을 찾을 수 없습니다.")
    return result


@router.put("/entries/{entry_id}", response_model=EntryResponse)
async def update_entry(entry_id: int, data: EntryUpdate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    try:
        result = await service.update_entry(session, entry_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
    return result


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(entry_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_entry(session, entry_id):
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없습니다.")
