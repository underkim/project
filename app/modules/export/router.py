from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.export import service

router = APIRouter(prefix="/api/v1/export", tags=["export"])


def _csv(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.get("/finance")
async def export_finance(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_finance(session), "finance.csv")


@router.get("/health/exercise")
async def export_exercise(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_exercise(session), "exercise.csv")


@router.get("/health/sleep")
async def export_sleep(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_sleep(session), "sleep.csv")


@router.get("/growth/books")
async def export_books(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_books(session), "books.csv")


@router.get("/growth/english")
async def export_english(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_english(session), "english.csv")


@router.get("/career")
async def export_career(
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_career(session), "career.csv")
