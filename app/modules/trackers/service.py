from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.trackers.models import Tracker, TrackerEntry
from app.modules.trackers.schemas import (
    EntryCreate, EntryResponse, EntryUpdate, TrackerCreate, TrackerDetail,
    TrackerResponse, TrackerSummary, TrackerUpdate, normalize_value,
)


async def list_trackers(session: AsyncSession, include_archived: bool = False) -> list[TrackerResponse]:
    query = select(Tracker).order_by(Tracker.is_archived, Tracker.created_at.desc())
    if not include_archived:
        query = query.where(Tracker.is_archived.is_(False))
    result = await session.execute(query)
    return [TrackerResponse.model_validate(item) for item in result.scalars().all()]


async def get_tracker(session: AsyncSession, tracker_id: int, limit: int = 50) -> TrackerDetail | None:
    result = await session.execute(
        select(Tracker).options(selectinload(Tracker.entries)).where(Tracker.id == tracker_id)
    )
    tracker = result.scalar_one_or_none()
    if tracker is None:
        return None
    entries = sorted(tracker.entries, key=lambda item: (item.entry_date, item.id), reverse=True)[:limit]
    data = TrackerResponse.model_validate(tracker).model_dump()
    return TrackerDetail(**data, entries=[EntryResponse.model_validate(item) for item in entries])


async def create_tracker(session: AsyncSession, data: TrackerCreate) -> TrackerResponse:
    async with session.begin():
        tracker = Tracker(**data.model_dump(mode="json"))
        session.add(tracker)
    return TrackerResponse.model_validate(tracker)


async def update_tracker(session: AsyncSession, tracker_id: int, data: TrackerUpdate) -> TrackerResponse | None:
    async with session.begin():
        tracker = await session.get(Tracker, tracker_id)
        if tracker is None:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            if field in {"name", "color"} and value is None:
                continue
            setattr(tracker, field, value.strip() or None if isinstance(value, str) else value)
    return TrackerResponse.model_validate(tracker)


async def delete_tracker(session: AsyncSession, tracker_id: int) -> bool:
    async with session.begin():
        tracker = await session.get(Tracker, tracker_id)
        if tracker is None:
            return False
        await session.delete(tracker)
    return True


async def create_entry(session: AsyncSession, tracker_id: int, data: EntryCreate) -> EntryResponse | None:
    async with session.begin():
        tracker = await session.get(Tracker, tracker_id)
        if tracker is None:
            return None
        entry = TrackerEntry(
            tracker_id=tracker_id,
            entry_date=data.entry_date,
            value=normalize_value(tracker.value_type, data.value),
            note=data.note.strip() or None if data.note else None,
        )
        session.add(entry)
    return EntryResponse.model_validate(entry)


async def update_entry(session: AsyncSession, entry_id: int, data: EntryUpdate) -> EntryResponse | None:
    async with session.begin():
        result = await session.execute(
            select(TrackerEntry).options(selectinload(TrackerEntry.tracker)).where(TrackerEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if entry is None:
            return None
        updates = data.model_dump(exclude_unset=True)
        if "value" in updates:
            updates["value"] = normalize_value(entry.tracker.value_type, updates["value"])
        if "note" in updates and updates["note"] is not None:
            updates["note"] = updates["note"].strip() or None
        for field, value in updates.items():
            setattr(entry, field, value)
    return EntryResponse.model_validate(entry)


async def delete_entry(session: AsyncSession, entry_id: int) -> bool:
    async with session.begin():
        entry = await session.get(TrackerEntry, entry_id)
        if entry is None:
            return False
        await session.delete(entry)
    return True


async def get_summary(session: AsyncSession) -> TrackerSummary:
    week_start = date.today() - timedelta(days=date.today().weekday())
    active = await session.scalar(select(func.count()).select_from(Tracker).where(Tracker.is_archived.is_(False)))
    weekly = await session.scalar(
        select(func.count()).select_from(TrackerEntry).where(TrackerEntry.entry_date >= week_start)
    )
    result = await session.execute(
        select(TrackerEntry).order_by(TrackerEntry.entry_date.desc(), TrackerEntry.id.desc()).limit(5)
    )
    return TrackerSummary(
        active_trackers=active or 0,
        entries_this_week=weekly or 0,
        recent_entries=[EntryResponse.model_validate(item) for item in result.scalars().all()],
    )
