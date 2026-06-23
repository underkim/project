from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.career import service
from app.modules.career.schemas import (
    CFRatingLogCreate,
    CFRatingLogResponse,
    CareerSettingsResponse,
    CareerSettingsUpdate,
    CareerSummaryResponse,
)

router = APIRouter(prefix="/api/v1/career", tags=["career"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=CareerSummaryResponse)
async def get_summary(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/settings", response_model=CareerSettingsResponse)
async def get_settings(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_settings(session)


@router.put("/settings", response_model=CareerSettingsResponse)
async def update_settings(
    data: CareerSettingsUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    return await service.update_settings(session, data)


@router.get("/cf-ratings", response_model=list[CFRatingLogResponse])
async def list_cf_ratings(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_cf_ratings(session, limit=limit, offset=offset)


@router.post("/cf-ratings", response_model=CFRatingLogResponse, status_code=status.HTTP_201_CREATED)
async def create_cf_rating(
    data: CFRatingLogCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    return await service.create_cf_rating(session, data)


@router.delete("/cf-ratings/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cf_rating(log_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_cf_rating(session, log_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="레이팅 기록을 찾을 수 없습니다.")
