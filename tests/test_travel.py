"""Travel 모듈 통합 테스트 (인메모리 SQLite)."""
import pytest
from datetime import date
from pydantic import ValidationError
from app.modules.travel.schemas import TripCreate, TripUpdate, PlanItemCreate


def test_trip_end_must_be_after_start():
    with pytest.raises(ValidationError):
        TripCreate(
            name="테스트",
            destination="서울",
            start_date=date(2026, 8, 5),
            end_date=date(2026, 8, 1),
        )


def test_trip_update_end_before_start_rejected():
    with pytest.raises(ValidationError):
        TripUpdate(start_date=date(2026, 8, 5), end_date=date(2026, 8, 1))


def test_trip_name_cannot_be_empty():
    with pytest.raises(ValidationError):
        TripCreate(name="  ", destination="서울", start_date=date(2026, 8, 1), end_date=date(2026, 8, 3))


def test_trip_destination_cannot_be_empty():
    with pytest.raises(ValidationError):
        TripCreate(name="테스트", destination="", start_date=date(2026, 8, 1), end_date=date(2026, 8, 3))


def test_plan_item_day_must_be_positive():
    with pytest.raises(ValidationError):
        PlanItemCreate(day=0, title="일정")


def test_plan_item_title_cannot_be_empty():
    with pytest.raises(ValidationError):
        PlanItemCreate(day=1, title="")


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


@pytest.mark.asyncio
async def test_add_and_delete_plan_item(auth_client):
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "일정 여행", "destination": "오사카", "start_date": "2026-11-01", "end_date": "2026-11-03",
    })).json()
    trip_id = trip["id"]

    item = (await auth_client.post(
        f"/api/v1/travel/trips/{trip_id}/plan",
        json={"day": 1, "title": "오사카 도착 + 도톤보리"},
    )).json()
    assert item["day"] == 1
    assert item["title"] == "오사카 도착 + 도톤보리"

    # 여행 조회 시 plan_items가 포함돼야 함
    trip_detail = (await auth_client.get(f"/api/v1/travel/trips/{trip_id}")).json()
    assert any(p["title"] == "오사카 도착 + 도톤보리" for p in trip_detail["plan_items"])

    # 일정 삭제
    del_resp = await auth_client.delete(f"/api/v1/travel/plan/{item['id']}")
    assert del_resp.status_code == 204

    trip_detail2 = (await auth_client.get(f"/api/v1/travel/trips/{trip_id}")).json()
    assert trip_detail2["plan_items"] == []


@pytest.mark.asyncio
async def test_update_trip_status_and_clear_note(auth_client):
    """여행 상태 변경 + note를 null로 지울 수 있어야 한다."""
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "업데이트 여행", "destination": "후쿠오카",
        "start_date": "2026-09-01", "end_date": "2026-09-03",
        "note": "기록할 것들",
    })).json()
    trip_id = trip["id"]
    assert trip["note"] == "기록할 것들"

    # note를 null로 명시적으로 지우기
    resp = await auth_client.put(f"/api/v1/travel/trips/{trip_id}", json={"note": None})
    assert resp.status_code == 200
    assert resp.json()["note"] is None
    assert resp.json()["name"] == "업데이트 여행"  # 다른 필드는 유지


@pytest.mark.asyncio
async def test_update_trip_invalid_date_range_returns_422(auth_client):
    """end_date를 start_date보다 이전으로 부분 업데이트하면 422여야 한다."""
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "날짜 검증 여행", "destination": "서울",
        "start_date": "2026-09-01", "end_date": "2026-09-05",
    })).json()
    trip_id = trip["id"]

    resp = await auth_client.put(f"/api/v1/travel/trips/{trip_id}", json={"end_date": "2026-08-01"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_checklist_item(auth_client):
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "체크 삭제 여행", "destination": "대구", "start_date": "2026-10-10", "end_date": "2026-10-12",
    })).json()
    trip_id = trip["id"]

    item = (await auth_client.post(
        f"/api/v1/travel/trips/{trip_id}/checklist", json={"text": "지갑 챙기기"},
    )).json()
    item_id = item["id"]

    del_resp = await auth_client.delete(f"/api/v1/travel/checklist/{item_id}")
    assert del_resp.status_code == 204

    trip_detail = (await auth_client.get(f"/api/v1/travel/trips/{trip_id}")).json()
    assert all(c["id"] != item_id for c in trip_detail["checklist_items"])


@pytest.mark.asyncio
async def test_create_trip_invalid_dates_returns_422(auth_client):
    """종료일이 시작일보다 이전이면 422여야 한다."""
    resp = await auth_client.post("/api/v1/travel/trips", json={
        "name": "날짜 오류 여행", "destination": "서울",
        "start_date": "2026-09-05", "end_date": "2026-09-01",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_trip_empty_name_returns_422(auth_client):
    resp = await auth_client.post("/api/v1/travel/trips", json={
        "name": "  ", "destination": "서울",
        "start_date": "2026-09-01", "end_date": "2026-09-05",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_trip_not_found_returns_404(auth_client):
    resp = await auth_client.get("/api/v1/travel/trips/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_trip_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/travel/trips/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_trip_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/travel/trips/99999", json={"status": "completed"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_toggle_checklist_item_not_found_returns_404(auth_client):
    resp = await auth_client.patch("/api/v1/travel/checklist/99999/toggle")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_checklist_item_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/travel/checklist/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_checklist_to_missing_trip_returns_404(auth_client):
    resp = await auth_client.post("/api/v1/travel/trips/99999/checklist", json={"text": "여권"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_plan_to_missing_trip_returns_404(auth_client):
    resp = await auth_client.post("/api/v1/travel/trips/99999/plan", json={"day": 1, "title": "관광"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_plan_item_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/travel/plan/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_trip_with_plan_and_checklist(auth_client):
    """plan_items, checklist_items가 있는 여행도 삭제 가능해야 한다."""
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "삭제 여행", "destination": "방콕", "start_date": "2026-12-01", "end_date": "2026-12-05",
    })).json()
    trip_id = trip["id"]

    await auth_client.post(f"/api/v1/travel/trips/{trip_id}/plan", json={"day": 1, "title": "왓 아룬 관광"})
    await auth_client.post(f"/api/v1/travel/trips/{trip_id}/checklist", json={"text": "선크림 챙기기"})

    del_resp = await auth_client.delete(f"/api/v1/travel/trips/{trip_id}")
    assert del_resp.status_code == 204

    # 여행 자체는 사라져야 함
    assert (await auth_client.get(f"/api/v1/travel/trips/{trip_id}")).status_code == 404
