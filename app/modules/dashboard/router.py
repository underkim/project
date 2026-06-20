from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.dashboard import service
from app.modules.dashboard.schemas import OverviewResponse

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_overview(session)
