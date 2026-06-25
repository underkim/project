"""Travel 모듈 통합 테스트 (인메모리 SQLite)."""
import pytest
from datetime import date
from pydantic import ValidationError
from app.modules.travel.schemas import TripCreate, PlanItemCreate


def test_trip_end_must_be_after_start():
    with pytest.raises(ValidationError):
        TripCreate(
            name="테스트",
            destination="서울",
            start_date=date(2026, 8, 5),
            end_date=date(2026, 8, 1),
        )


def test_plan_item_day_must_be_positive():
    with pytest.raises(ValidationError):
        PlanItemCreate(day=0, title="일정")


def test_travel_routes_registered(app):
    routes = {r.path for r in app.routes}
    assert "/api/v1/travel/trips" in routes
    assert "/api/v1/travel/summary" in routes


@pytest.mark.asyncio
async def test_list_trips_empty(auth_client):
    resp = await auth_client.get("/api/v1/travel/trips")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_trip(auth_client):
    payload = {
        "name": "도쿄 여행",
        "destination": "일본 도쿄",
        "start_date": "2026-08-01",
        "end_date": "2026-08-05",
        "status": "planned",
    }
    resp = await auth_client.post("/api/v1/travel/trips", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "도쿄 여행"
    assert data["destination"] == "일본 도쿄"
    assert data["checklist_items"] == []


@pytest.mark.asyncio
async def test_list_trips_after_create(auth_client):
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "부산 여행", "destination": "부산", "start_date": "2026-07-01", "end_date": "2026-07-03",
    })
    resp = await auth_client.get("/api/v1/travel/trips")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_delete_trip(auth_client):
    create = await auth_client.post("/api/v1/travel/trips", json={
        "name": "삭제할 여행", "destination": "서울", "start_date": "2026-09-01", "end_date": "2026-09-02",
    })
    trip_id = create.json()["id"]

    resp = await auth_client.delete(f"/api/v1/travel/trips/{trip_id}")
    assert resp.status_code == 204

    list_resp = await auth_client.get("/api/v1/travel/trips")
    assert all(t["id"] != trip_id for t in list_resp.json())


@pytest.mark.asyncio
async def test_add_and_toggle_checklist(auth_client):
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "체크리스트 여행", "destination": "제주", "start_date": "2026-10-01", "end_date": "2026-10-03",
    })).json()
    trip_id = trip["id"]

    item = (await auth_client.post(
        f"/api/v1/travel/trips/{trip_id}/checklist",
        json={"text": "여권 챙기기"},
    )).json()
    assert item["text"] == "여권 챙기기"
    assert item["is_checked"] is False

    toggled = (await auth_client.patch(
        f"/api/v1/travel/checklist/{item['id']}/toggle"
    )).json()
    assert toggled["is_checked"] is True


@pytest.mark.asyncio
async def test_travel_summary(auth_client):
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "완료 여행", "destination": "파리", "start_date": "2025-01-01", "end_date": "2025-01-05",
        "status": "completed",
    })
    resp = await auth_client.get("/api/v1/travel/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert data["completed"] >= 1


@pytest.mark.asyncio
async def test_trip_requires_auth(client):
    resp = await client.get("/api/v1/travel/trips")
    assert resp.status_code == 401
