from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.health import service
from app.modules.health.schemas import (
    ExerciseLogCreate,
    ExerciseLogResponse,
    ExerciseLogUpdate,
    HealthSummaryResponse,
    SleepLogCreate,
    SleepLogResponse,
    SleepLogUpdate,
)

router = APIRouter(prefix="/api/v1/health", tags=["health"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=HealthSummaryResponse)
async def get_summary(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/exercise", response_model=list[ExerciseLogResponse])
async def list_exercise(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_exercise(session, limit=limit, offset=offset)


@router.post("/exercise", response_model=ExerciseLogResponse, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    data: ExerciseLogCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    return await service.create_exercise(session, data)


@router.put("/exercise/{log_id}", response_model=ExerciseLogResponse)
async def update_exercise(
    log_id: int,
    data: ExerciseLogUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.update_exercise(session, log_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운동 기록을 찾을 수 없습니다.")
    return result


@router.delete("/exercise/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(log_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_exercise(session, log_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="운동 기록을 찾을 수 없습니다.")


@router.get("/sleep", response_model=list[SleepLogResponse])
async def list_sleep(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_sleep(session, limit=limit, offset=offset)


@router.post("/sleep", response_model=SleepLogResponse, status_code=status.HTTP_201_CREATED)
async def create_sleep(
    data: SleepLogCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await service.create_sleep(session, data)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="해당 날짜에 이미 수면 기록이 있어요.")


@router.put("/sleep/{log_id}", response_model=SleepLogResponse)
async def update_sleep(
    log_id: int,
    data: SleepLogUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    result = await service.update_sleep(session, log_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수면 기록을 찾을 수 없습니다.")
    return result


@router.delete("/sleep/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sleep(log_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_sleep(session, log_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수면 기록을 찾을 수 없습니다.")
