from datetime import date

from fastapi import APIRouter, Depends, Query
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
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_finance(session, start_date, end_date), "finance.csv")


@router.get("/health/exercise")
async def export_exercise(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_exercise(session, start_date, end_date), "exercise.csv")


@router.get("/health/sleep")
async def export_sleep(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_sleep(session, start_date, end_date), "sleep.csv")


@router.get("/growth/books")
async def export_books(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_books(session, start_date, end_date), "books.csv")


@router.get("/growth/english")
async def export_english(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_english(session, start_date, end_date), "english.csv")


@router.get("/career")
async def export_career(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_career(session, start_date, end_date), "career.csv")


@router.get("/travel")
async def export_travel(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_travel(session, start_date, end_date), "travel.csv")


@router.get("/trackers")
async def export_trackers(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    _: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return _csv(await service.export_trackers(session, start_date, end_date), "trackers.csv")
