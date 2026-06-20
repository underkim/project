from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
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
    GrowthSummaryResponse,
)

router = APIRouter(prefix="/api/v1/growth", tags=["growth"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/summary", response_model=GrowthSummaryResponse)
async def get_summary(session: AsyncSession = Depends(get_db)):
    return await service.get_summary(session)


@router.get("/books", response_model=list[BookRecordResponse])
async def list_books(session: AsyncSession = Depends(get_db)):
    return await service.list_books(session)


@router.post("/books", response_model=BookRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_book(data: BookRecordCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.create_book(session, data)


@router.put("/books/{book_id}", response_model=BookRecordResponse)
async def update_book(
    book_id: int, data: BookRecordUpdate, _: CurrentUser, session: AsyncSession = Depends(get_db)
):
    result = await service.update_book(session, book_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return result


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_book(book_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_book(session, book_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")


@router.get("/english", response_model=list[EnglishLogResponse])
async def list_english(session: AsyncSession = Depends(get_db)):
    return await service.list_english(session)


@router.post("/english", response_model=EnglishLogResponse, status_code=status.HTTP_201_CREATED)
async def create_english(data: EnglishLogCreate, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    return await service.create_english(session, data)


@router.delete("/english/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_english(log_id: int, _: CurrentUser, session: AsyncSession = Depends(get_db)):
    if not await service.delete_english(session, log_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
