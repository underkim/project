from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.models import Category, Phase, RoadmapItem, RoadmapSettings
from app.modules.planner.schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CategoryUpdateResponse,
    ItemStatus,
    ItemToggleResponse,
    PhaseResponse,
    PhaseUpdate,
    PhaseUpdateResponse,
    RoadmapItemCreate,
    RoadmapItemResponse,
    RoadmapItemUpdate,
    RoadmapResponse,
    SettingsResponse,
    SettingsUpdate,
)


def _item_status(deadline: date | None, is_completed: bool) -> ItemStatus | None:
    if is_completed:
        return ItemStatus.completed
    if deadline is None:
        return None
    today = date.today()
    if deadline < today:
        return ItemStatus.overdue
    if deadline <= today + timedelta(days=30):
        return ItemStatus.urgent
    return ItemStatus.on_track


def _phase_start(start_date: date, phases: list[Phase], target_order: int) -> date:
    """target_order 미만 phase들의 months를 누적해 해당 phase 시작일을 반환."""
    accumulated = 0
    for phase in sorted(phases, key=lambda p: p.order_index):
        if phase.order_index >= target_order:
            break
        accumulated += phase.months
    return start_date + relativedelta(months=accumulated)


async def get_settings(session: AsyncSession) -> SettingsResponse:
    result = await session.execute(select(RoadmapSettings))
    settings = result.scalar_one_or_none()
    return SettingsResponse(start_date=settings.start_date if settings else None)


async def update_settings(session: AsyncSession, data: SettingsUpdate) -> SettingsResponse:
    async with session.begin():
        result = await session.execute(select(RoadmapSettings))
        settings = result.scalar_one_or_none()
        if settings is None:
            settings = RoadmapSettings(start_date=data.start_date)
            session.add(settings)
        else:
            settings.start_date = data.start_date
    return SettingsResponse(start_date=settings.start_date)


async def get_roadmap(session: AsyncSession) -> RoadmapResponse:
    settings_result = await session.execute(select(RoadmapSettings))
    settings = settings_result.scalar_one_or_none()
    start_date = settings.start_date if settings else None

    stmt = (
        select(Phase)
        .options(
            selectinload(Phase.categories).selectinload(Category.items)
        )
        .order_by(Phase.order_index)
    )
    result = await session.execute(stmt)
    phases = result.scalars().all()

    today = date.today()
    phase_responses = []
    for phase in phases:
        phase_start = _phase_start(start_date, list(phases), phase.order_index) if start_date else None
        phase_end = (phase_start + relativedelta(months=phase.months)) if phase_start else None
        is_current = (
            phase_start is not None
            and phase_end is not None
            and phase_start <= today < phase_end
        )

        category_responses = []
        for category in phase.categories:
            item_responses = []
            for item in category.items:
                deadline = None
                if phase_start is not None:
                    deadline = phase_start + timedelta(days=round(item.offset * 30.44))
                item_responses.append(
                    RoadmapItemResponse(
                        id=item.id,
                        text=item.text,
                        offset=item.offset,
                        is_completed=item.is_completed,
                        deadline=deadline,
                        status=_item_status(deadline, item.is_completed),
                    )
                )
            category_responses.append(
                CategoryResponse(
                    id=category.id,
                    icon=category.icon,
                    title=category.title,
                    subtitle=category.subtitle,
                    order_index=category.order_index,
                    items=item_responses,
                )
            )
        phase_responses.append(
            PhaseResponse(
                id=phase.id,
                name=phase.name,
                label=phase.label,
                order_index=phase.order_index,
                months=phase.months,
                color=phase.color,
                start_date=phase_start,
                end_date=phase_end,
                is_current=is_current,
                categories=category_responses,
            )
        )

    return RoadmapResponse(start_date=start_date, phases=phase_responses)


async def toggle_item(session: AsyncSession, item_id: int) -> ItemToggleResponse | None:
    async with session.begin():
        item = await session.get(RoadmapItem, item_id)
        if item is None:
            return None
        item.is_completed = not item.is_completed
    return ItemToggleResponse(id=item.id, is_completed=item.is_completed)


async def create_item(session: AsyncSession, data: RoadmapItemCreate) -> RoadmapItemResponse | None:
    async with session.begin():
        category = await session.get(Category, data.category_id)
        if category is None:
            return None
        item = RoadmapItem(category_id=data.category_id, text=data.text, offset=data.offset, is_completed=False)
        session.add(item)
    return RoadmapItemResponse(id=item.id, text=item.text, offset=item.offset, is_completed=False)


async def update_item(session: AsyncSession, item_id: int, data: RoadmapItemUpdate) -> RoadmapItemResponse | None:
    async with session.begin():
        item = await session.get(RoadmapItem, item_id)
        if item is None:
            return None
        if data.text is not None:
            item.text = data.text
        if data.offset is not None:
            item.offset = data.offset
    return RoadmapItemResponse(id=item.id, text=item.text, offset=item.offset, is_completed=item.is_completed)


async def delete_item(session: AsyncSession, item_id: int) -> bool:
    async with session.begin():
        item = await session.get(RoadmapItem, item_id)
        if item is None:
            return False
        await session.delete(item)
    return True


async def create_category(session: AsyncSession, data: CategoryCreate) -> CategoryResponse | None:
    async with session.begin():
        phase = await session.get(Phase, data.phase_id)
        if phase is None:
            return None
        result = await session.execute(
            select(func.max(Category.order_index)).where(Category.phase_id == data.phase_id)
        )
        max_order = result.scalar_one_or_none()
        cat = Category(
            phase_id=data.phase_id,
            icon=data.icon,
            title=data.title,
            subtitle=data.subtitle,
            order_index=(max_order + 1) if max_order is not None else 0,
        )
        session.add(cat)
        await session.flush()
    return CategoryResponse(id=cat.id, icon=cat.icon, title=cat.title, subtitle=cat.subtitle, order_index=cat.order_index, items=[])


async def delete_category(session: AsyncSession, cat_id: int) -> bool:
    async with session.begin():
        stmt = (
            select(Category)
            .where(Category.id == cat_id)
            .options(selectinload(Category.items))
        )
        result = await session.execute(stmt)
        cat = result.scalar_one_or_none()
        if cat is None:
            return False
        await session.delete(cat)
    return True


async def update_phase(session: AsyncSession, phase_id: int, data: PhaseUpdate) -> PhaseUpdateResponse | None:
    async with session.begin():
        phase = await session.get(Phase, phase_id)
        if phase is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(phase, field, value)
    return PhaseUpdateResponse(
        id=phase.id, name=phase.name, label=phase.label,
        months=phase.months, color=phase.color,
    )


async def update_category(session: AsyncSession, cat_id: int, data: CategoryUpdate) -> CategoryUpdateResponse | None:
    async with session.begin():
        cat = await session.get(Category, cat_id)
        if cat is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(cat, field, value)
    return CategoryUpdateResponse(
        id=cat.id, icon=cat.icon, title=cat.title,
        subtitle=cat.subtitle, order_index=cat.order_index,
    )
