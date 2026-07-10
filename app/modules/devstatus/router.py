from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.modules.devstatus import service
from app.modules.devstatus.schemas import ActivityLog, DevStatusOverview

router = APIRouter(prefix="/api/v1/devstatus", tags=["devstatus"])
CurrentUser = Annotated[str, Depends(get_current_user)]


@router.get("/overview", response_model=DevStatusOverview)
async def get_overview(_: CurrentUser):
    return service.get_overview()


@router.get("/activity", response_model=ActivityLog | None)
async def get_activity(_: CurrentUser):
    return service.get_activity_log()
