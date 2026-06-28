from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.travel.geocoding import geocode
from app.modules.travel.models import Trip, TripChecklistItem, TripPlanItem, TripRestaurant
from app.modules.travel.schemas import (
    ChecklistItemCreate,
    ChecklistItemResponse,
    PlanItemCreate,
    PlanItemResponse,
    RestaurantCreate,
    RestaurantResponse,
    RestaurantUpdate,
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
        address=trip.address,
        latitude=trip.latitude,
        longitude=trip.longitude,
        checklist_items=[ChecklistItemResponse.model_validate(item) for item in trip.checklist_items],
        plan_items=[PlanItemResponse.model_validate(p) for p in trip.plan_items],
        restaurants=[RestaurantResponse.model_validate(r) for r in trip.restaurants],
    )


def _trip_opts():
    return [
        selectinload(Trip.checklist_items),
        selectinload(Trip.plan_items),
        selectinload(Trip.restaurants),
    ]


async def _maybe_geocode(payload: dict) -> None:
    """payload에 address가 있고 좌표가 명시되지 않았으면 지오코딩으로 좌표 보강 (in-place)."""
    if payload.get("address") and payload.get("latitude") is None and payload.get("longitude") is None:
        coords = await geocode(payload["address"])
        if coords:
            payload["latitude"], payload["longitude"] = coords


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
    payload = data.model_dump()
    await _maybe_geocode(payload)  # 트랜잭션 밖에서 네트워크 호출
    async with session.begin():
        trip = Trip(**payload)
        session.add(trip)
        await session.flush()
        await session.refresh(trip, attribute_names=["checklist_items", "plan_items", "restaurants"])
    return _trip_to_response(trip)


async def update_trip(
    session: AsyncSession, trip_id: int, data: TripUpdate
) -> TripResponse | None:
    update = data.model_dump(exclude_unset=True)
    # address가 바뀌고 좌표를 명시하지 않았으면 지오코딩 (트랜잭션 밖)
    if "address" in update and update.get("address") and "latitude" not in update and "longitude" not in update:
        coords = await geocode(update["address"])
        if coords:
            update["latitude"], update["longitude"] = coords
    async with session.begin():
        result = await session.execute(
            select(Trip)
            .options(*_trip_opts())
            .where(Trip.id == trip_id)
        )
        trip = result.scalar_one_or_none()
        if trip is None:
            return None
        for field, value in update.items():
            setattr(trip, field, value)
        if trip.end_date < trip.start_date:
            raise ValueError("종료일은 시작일 이후여야 합니다")
    return _trip_to_response(trip)


async def delete_trip(session: AsyncSession, trip_id: int) -> bool:
    async with session.begin():
        trip = await session.get(Trip, trip_id)
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
        await session.flush()
        return ChecklistItemResponse.model_validate(item)


async def toggle_checklist_item(
    session: AsyncSession, item_id: int
) -> ChecklistItemResponse | None:
    async with session.begin():
        item = await session.get(TripChecklistItem, item_id)
        if item is None:
            return None
        item.is_checked = not item.is_checked
    return ChecklistItemResponse.model_validate(item)


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
        await session.flush()
        return PlanItemResponse.model_validate(item)


async def delete_plan_item(session: AsyncSession, item_id: int) -> bool:
    async with session.begin():
        item = await session.get(TripPlanItem, item_id)
        if item is None:
            return False
        await session.delete(item)
    return True


async def update_plan_item(
    session: AsyncSession, item_id: int, data: "PlanItemUpdate"
) -> "PlanItemResponse | None":
    from app.modules.travel.schemas import PlanItemUpdate as _PlanItemUpdate, PlanItemResponse as _PlanItemResponse  # noqa
    async with session.begin():
        item = await session.get(TripPlanItem, item_id)
        if item is None:
            return None
        update = data.model_dump(exclude_unset=True)
        for k, v in update.items():
            setattr(item, k, v)
        await session.flush()
        return _PlanItemResponse.model_validate(item)


async def add_restaurant(
    session: AsyncSession, trip_id: int, data: RestaurantCreate
) -> RestaurantResponse | None:
    payload = data.model_dump()
    await _maybe_geocode(payload)  # 트랜잭션 밖에서 네트워크 호출
    async with session.begin():
        trip = await session.get(Trip, trip_id)
        if trip is None:
            return None
        restaurant = TripRestaurant(trip_id=trip_id, **payload)
        session.add(restaurant)
        await session.flush()
        return RestaurantResponse.model_validate(restaurant)


async def update_restaurant(
    session: AsyncSession, restaurant_id: int, data: RestaurantUpdate
) -> RestaurantResponse | None:
    update = data.model_dump(exclude_unset=True)
    if "address" in update and update.get("address") and "latitude" not in update and "longitude" not in update:
        coords = await geocode(update["address"])
        if coords:
            update["latitude"], update["longitude"] = coords
    async with session.begin():
        restaurant = await session.get(TripRestaurant, restaurant_id)
        if restaurant is None:
            return None
        for field, value in update.items():
            setattr(restaurant, field, value)
        await session.flush()
        return RestaurantResponse.model_validate(restaurant)


async def delete_restaurant(session: AsyncSession, restaurant_id: int) -> bool:
    async with session.begin():
        restaurant = await session.get(TripRestaurant, restaurant_id)
        if restaurant is None:
            return False
        await session.delete(restaurant)
    return True


async def get_next_trip(session: AsyncSession) -> Trip | None:
    """다음 여행 조회 (진행 중 우선, 예정은 가장 가까운 날짜)."""
    result = await session.execute(
        select(Trip)
        .options(
            selectinload(Trip.checklist_items),
            selectinload(Trip.plan_items),
            selectinload(Trip.restaurants),
        )
        .where(Trip.status.in_(["ongoing", "planned"]))
        .order_by(
            case((Trip.status == "ongoing", 0), else_=1),
            Trip.start_date.asc(),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_summary(session: AsyncSession) -> TravelSummaryResponse:
    row = (await session.execute(
        select(
            func.count().label("total"),
            func.count(case((Trip.status == "planned", 1))).label("planned"),
            func.count(case((Trip.status == "ongoing", 1))).label("ongoing"),
            func.count(case((Trip.status == "completed", 1))).label("completed"),
        ).select_from(Trip)
    )).one()
    return TravelSummaryResponse(
        total=row.total,
        planned=row.planned,
        ongoing=row.ongoing,
        completed=row.completed,
    )
