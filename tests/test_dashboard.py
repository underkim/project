"""Dashboard 모듈 통합 테스트."""
import pytest


def test_dashboard_route_registered(app):
    routes = {r.path for r in app.routes}
    assert "/api/v1/dashboard/overview" in routes


@pytest.mark.asyncio
async def test_overview_empty_db(auth_client):
    """데이터 없을 때도 200 반환하고 올바른 구조를 갖는지 확인."""
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "planner" in data
    assert "finance" in data
    assert "health" in data
    assert "growth" in data
    assert "career" in data
    assert "travel" in data


@pytest.mark.asyncio
async def test_overview_with_data(auth_client):
    """데이터 저장 후 overview가 반영하는지 확인."""
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-21",
        "exercise_type": "러닝",
        "duration_minutes": 30,
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["health"] is not None


@pytest.mark.asyncio
async def test_overview_requires_auth(client):
    resp = await client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 401
