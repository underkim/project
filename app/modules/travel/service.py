from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.travel.models import Trip, TripChecklistItem, TripPlanItem
from app.modules.travel.schemas import (
    ChecklistItemCreate,
    ChecklistItemResponse,
    PlanItemCreate,
    PlanItemResponse,
    TravelSummaryResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
)


def _trip_to_response(trip: Trip) -> TripResponse:
    return TripResponse(
        id=trip.id,
        name=trip.name,
        destination=trip.destination,
        start_date=trip.start_date,
        end_date=trip.end_date,
        status=trip.status,
        note=trip.note,
        checklist_items=[
            ChecklistItemResponse(
                id=item.id,
                text=item.text,
                is_checked=item.is_checked,
                order_index=item.order_index,
            )
            for item in trip.checklist_items
        ],
        plan_items=[
            PlanItemResponse(
                id=p.id,
                day=p.day,
                sort_order=p.sort_order,
                time=p.time,
                title=p.title,
                description=p.description,
            )
            for p in trip.plan_items
        ],
    )


def _trip_opts():
    return [selectinload(Trip.checklist_items), selectinload(Trip.plan_items)]


async def list_trips(session: AsyncSession) -> list[TripResponse]:
    result = await session.execute(
        select(Trip)
        .options(*_trip_opts())
        .order_by(Trip.start_date.desc())
    )
    return [_trip_to_response(t) for t in result.scalars().all()]


async def get_trip(session: AsyncSession, trip_id: int) -> TripResponse | None:
    result = await session.execute(
        select(Trip)
        .options(*_trip_opts())
        .where(Trip.id == trip_id)
    )
    trip = result.scalar_one_or_none()
    return _trip_to_response(trip) if trip else None


async def create_trip(session: AsyncSession, data: TripCreate) -> TripResponse:
    async with session.begin():
        trip = Trip(**data.model_dump())
        session.add(trip)
        await session.flush()
        await session.refresh(trip, attribute_names=["checklist_items", "plan_items"])
    return _trip_to_response(trip)


async def update_trip(
    session: AsyncSession, trip_id: int, data: TripUpdate
) -> TripResponse | None:
    async with session.begin():
        result = await session.execute(
            select(Trip)
            .options(*_trip_opts())
            .where(Trip.id == trip_id)
        )
        trip = result.scalar_one_or_none()
        if trip is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(trip, field, value)
    return _trip_to_response(trip)


async def delete_trip(session: AsyncSession, trip_id: int) -> bool:
    async with session.begin():
        result = await session.execute(
            select(Trip)
            .options(*_trip_opts())
            .where(Trip.id == trip_id)
        )
        trip = result.scalar_one_or_none()
        if trip is None:
            return False
        await session.delete(trip)
    return True


async def add_checklist_item(
    session: AsyncSession, trip_id: int, data: ChecklistItemCreate
) -> ChecklistItemResponse | None:
    async with session.begin():
        trip = await session.get(Trip, trip_id)
        if trip is None:
            return None
        item = TripChecklistItem(
            trip_id=trip_id,
            text=data.text,
            is_checked=False,
            order_index=data.order_index,
        )
        session.add(item)
    return ChecklistItemResponse(
        id=item.id,
        text=item.text,
        is_checked=item.is_checked,
        order_index=item.order_index,
    )


async def toggle_checklist_item(
    session: AsyncSession, item_id: int
) -> ChecklistItemResponse | None:
    async with session.begin():
        item = await session.get(TripChecklistItem, item_id)
        if item is None:
            return None
        item.is_checked = not item.is_checked
    return ChecklistItemResponse(
        id=item.id,
        text=item.text,
        is_checked=item.is_checked,
        order_index=item.order_index,
    )


async def delete_checklist_item(session: AsyncSession, item_id: int) -> bool:
    async with session.begin():
        item = await session.get(TripChecklistItem, item_id)
        if item is None:
            return False
        await session.delete(item)
    return True


async def add_plan_item(
    session: AsyncSession, trip_id: int, data: PlanItemCreate
) -> PlanItemResponse | None:
    async with session.begin():
        trip = await session.get(Trip, trip_id)
        if trip is None:
            return None
        item = TripPlanItem(
            trip_id=trip_id,
            day=data.day,
            sort_order=data.sort_order,
            time=data.time,
            title=data.title,
            description=data.description,
        )
        session.add(item)
    return PlanItemResponse(
        id=item.id,
        day=item.day,
        sort_order=item.sort_order,
        time=item.time,
        title=item.title,
        description=item.description,
    )


async def delete_plan_item(session: AsyncSession, item_id: int) -> bool:
    async with session.begin():
        item = await session.get(TripPlanItem, item_id)
        if item is None:
            return False
        await session.delete(item)
    return True


async def get_summary(session: AsyncSession) -> TravelSummaryResponse:
    result = await session.execute(select(Trip))
    trips = result.scalars().all()
    return TravelSummaryResponse(
        total=len(trips),
        planned=sum(1 for t in trips if t.status == "planned"),
        ongoing=sum(1 for t in trips if t.status == "ongoing"),
        completed=sum(1 for t in trips if t.status == "completed"),
    )
