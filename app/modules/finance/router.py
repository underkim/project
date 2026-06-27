from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.finance import service
from app.modules.finance.schemas import (
    AssetRecordCreate,
    AssetRecordResponse,
    AssetRecordUpdate,
    FinanceSummaryResponse,
)

router = APIRouter(prefix="/api/v1/finance", tags=["finance"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=FinanceSummaryResponse)
async def get_summary(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    records_limit: int = Query(default=20, ge=1, le=200),
    records_offset: int = Query(default=0, ge=0),
):
    return await service.get_summary(session, records_limit=records_limit, records_offset=records_offset)


@router.get("/records", response_model=list[AssetRecordResponse])
async def list_records(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_records(session, limit=limit, offset=offset)


@router.get("/records/{record_id}", response_model=AssetRecordResponse)
async def get_record(record_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    result = await service.get_record(session, record_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="재테크 기록을 찾을 수 없습니다.")
    return result


@router.post("/records", response_model=AssetRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    data: AssetRecordCreate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        return await service.create_record(session, data)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="해당 날짜에 이미 재테크 기록이 있어요.")


@router.put("/records/{record_id}", response_model=AssetRecordResponse)
async def update_record(
    record_id: int,
    data: AssetRecordUpdate,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    try:
        result = await service.update_record(session, record_id, data)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="해당 날짜에 이미 재테크 기록이 있어요.")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="재테크 기록을 찾을 수 없습니다.")
    return result


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: int,
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_record(session, record_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="재테크 기록을 찾을 수 없습니다.")
