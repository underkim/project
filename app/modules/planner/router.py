from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.planner import service
from app.modules.planner.schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CategoryUpdateResponse,
    ItemToggleResponse,
    PhaseUpdate,
    PhaseUpdateResponse,
    RoadmapItemCreate,
    RoadmapItemResponse,
    RoadmapItemUpdate,
    RoadmapResponse,
    SettingsResponse,
    SettingsUpdate,
)

router = APIRouter(prefix="/api/v1/planner", tags=["planner"])


@router.get("/roadmap", response_model=RoadmapResponse)
async def get_roadmap(
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_roadmap(session)


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.get_settings(session)


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return await service.update_settings(session, data)


@router.patch("/items/{item_id}/toggle", response_model=ItemToggleResponse)
async def toggle_item(
    item_id: int,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.toggle_item(session, item_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return result


@router.post("/items", response_model=RoadmapItemResponse, status_code=201)
async def create_item(
    data: RoadmapItemCreate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.create_item(session, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return result


@router.put("/items/{item_id}", response_model=RoadmapItemResponse)
async def update_item(
    item_id: int,
    data: RoadmapItemUpdate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.update_item(session, item_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return result


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: int,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    success = await service.delete_item(session, item_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")


@router.put("/phases/{phase_id}", response_model=PhaseUpdateResponse)
async def update_phase(
    phase_id: int,
    data: PhaseUpdate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.update_phase(session, phase_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    return result


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.create_category(session, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")
    return result


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    success = await service.delete_category(session, cat_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")


@router.put("/categories/{cat_id}", response_model=CategoryUpdateResponse)
async def update_category(
    cat_id: int,
    data: CategoryUpdate,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
):
    result = await service.update_category(session, cat_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return result
