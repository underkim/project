import pytest


def test_tracker_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/trackers" in routes
    assert "/api/v1/trackers/{tracker_id}/entries" in routes


@pytest.mark.asyncio
async def test_tracker_crud_and_entries(auth_client):
    created = await auth_client.post("/api/v1/trackers", json={
        "name": "운동 시간", "value_type": "number", "unit": "분", "color": "#10b981"
    })
    assert created.status_code == 201
    tracker_id = created.json()["id"]

    entry = await auth_client.post(f"/api/v1/trackers/{tracker_id}/entries", json={
        "entry_date": "2026-07-12", "value": "45", "note": "가볍게 달리기"
    })
    assert entry.status_code == 201
    assert entry.json()["value"] == "45"

    detail = await auth_client.get(f"/api/v1/trackers/{tracker_id}")
    assert detail.status_code == 200
    assert detail.json()["entries"][0]["note"] == "가볍게 달리기"

    archived = await auth_client.put(f"/api/v1/trackers/{tracker_id}", json={"is_archived": True})
    assert archived.json()["is_archived"] is True
    assert (await auth_client.get("/api/v1/trackers")).json() == []


@pytest.mark.asyncio
async def test_tracker_value_type_validation(auth_client):
    created = await auth_client.post("/api/v1/trackers", json={"name": "몸무게", "value_type": "number"})
    tracker_id = created.json()["id"]
    invalid = await auth_client.post(f"/api/v1/trackers/{tracker_id}/entries", json={
        "entry_date": "2026-07-12", "value": "무거움"
    })
    assert invalid.status_code == 422
    assert "숫자" in invalid.json()["detail"]


@pytest.mark.asyncio
async def test_delete_tracker_cascades_entries(auth_client):
    created = await auth_client.post("/api/v1/trackers", json={"name": "습관", "value_type": "checkbox"})
    tracker_id = created.json()["id"]
    entry = await auth_client.post(f"/api/v1/trackers/{tracker_id}/entries", json={
        "entry_date": "2026-07-12", "value": "true"
    })
    entry_id = entry.json()["id"]
    assert (await auth_client.delete(f"/api/v1/trackers/{tracker_id}")).status_code == 204
    assert (await auth_client.delete(f"/api/v1/trackers/entries/{entry_id}")).status_code == 404


@pytest.mark.asyncio
async def test_tracker_endpoints_require_auth(client):
    assert (await client.get("/api/v1/trackers")).status_code == 401


@pytest.mark.asyncio
async def test_tracker_summary(auth_client):
    created = await auth_client.post("/api/v1/trackers", json={"name": "기분", "value_type": "text"})
    await auth_client.post(f"/api/v1/trackers/{created.json()['id']}/entries", json={
        "entry_date": "2026-07-12", "value": "좋음"
    })
    summary = await auth_client.get("/api/v1/trackers/summary")
    assert summary.status_code == 200
    assert summary.json()["active_trackers"] >= 1
    assert summary.json()["recent_entries"]
