from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.growth import service
from app.modules.growth.schemas import (
    BookRecordCreate,
    BookRecordResponse,
    BookRecordUpdate,
    EnglishLogCreate,
    EnglishLogResponse,
    EnglishLogUpdate,
    GrowthSummaryResponse,
)

router = APIRouter(prefix="/api/v1/growth", tags=["growth"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=GrowthSummaryResponse)
async def get_summary(_: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/books", response_model=list[BookRecordResponse])
async def list_books(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_books(session, limit=limit, offset=offset)


@router.post("/books", response_model=BookRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_book(data: BookRecordCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.create_book(session, data)


@router.put("/books/{book_id}", response_model=BookRecordResponse)
async def update_book(
    book_id: int, data: BookRecordUpdate, _: CurrentUser, session: AsyncSession = Depends(get_db)
):
    try:
        result = await service.update_book(session, book_id, data)
    except ValueError:
        raise HTTPException(status_code=422, detail="완료일은 시작일 이후여야 합니다.")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="도서 기록을 찾을 수 없습니다.")
    return result


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(book_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_book(session, book_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="도서 기록을 찾을 수 없습니다.")


@router.get("/english", response_model=list[EnglishLogResponse])
async def list_english(
    _: CurrentUser,
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await service.list_english(session, limit=limit, offset=offset)


@router.post("/english", response_model=EnglishLogResponse, status_code=status.HTTP_201_CREATED)
async def create_english(data: EnglishLogCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.create_english(session, data)


@router.put("/english/{log_id}", response_model=EnglishLogResponse)
async def update_english(
    log_id: int, data: EnglishLogUpdate, _: CurrentUser, session: AsyncSession = Depends(get_db)
):
    result = await service.update_english(session, log_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="영어 학습 기록을 찾을 수 없습니다.")
    return result


@router.delete("/english/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_english(log_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_english(session, log_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="영어 학습 기록을 찾을 수 없습니다.")
