"""Dashboard 모듈 통합 테스트."""
import pytest
from unittest.mock import patch, AsyncMock


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
    assert "meta" in data
    assert data["meta"]["partial_failure"] is False
    assert data["meta"]["failed_modules"] == []


@pytest.mark.asyncio
async def test_overview_partial_failure_meta(auth_client):
    """일부 snapshot 함수가 실패해도 200을 반환하고 meta에 실패 모듈이 기록된다."""
    async def raise_error(session):
        raise RuntimeError("simulated finance failure")

    with patch(
        "app.modules.dashboard.service._finance_snapshot",
        side_effect=raise_error,
    ):
        resp = await auth_client.get("/api/v1/dashboard/overview")

    assert resp.status_code == 200
    data = resp.json()
    assert data["finance"] is None
    assert data["meta"]["partial_failure"] is True
    assert "finance" in data["meta"]["failed_modules"]
    # 나머지 모듈은 영향 없음
    assert "planner" not in data["meta"]["failed_modules"]


@pytest.mark.asyncio
async def test_overview_multi_module_partial_failure(auth_client):
    """두 모듈이 동시에 실패해도 failed_modules에 모두 포함된다."""
    async def raise_error(session):
        raise RuntimeError("simulated failure")

    with (
        patch("app.modules.dashboard.service._finance_snapshot", side_effect=raise_error),
        patch("app.modules.dashboard.service._growth_snapshot", side_effect=raise_error),
    ):
        resp = await auth_client.get("/api/v1/dashboard/overview")

    assert resp.status_code == 200
    data = resp.json()
    assert data["meta"]["partial_failure"] is True
    assert set(data["meta"]["failed_modules"]) == {"finance", "growth"}


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


@pytest.mark.asyncio
async def test_overview_growth_books_reading_reflected(auth_client):
    """읽는 중 도서 생성 후 overview.growth.books_reading이 반영되어야 한다."""
    await auth_client.post("/api/v1/growth/books", json={"title": "대시보드 테스트 책", "status": "reading"})
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["growth"] is not None
    assert data["growth"]["books_reading"] >= 1


@pytest.mark.asyncio
async def test_overview_health_exercise_reflected(auth_client):
    """운동 기록 후 overview.health.exercise_days_this_week가 반영되어야 한다."""
    from datetime import date
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": date.today().isoformat(), "exercise_type": "헬스", "duration_minutes": 60,
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["health"] is not None
    assert data["health"]["exercise_days_this_week"] >= 1
    assert data["health"]["total_exercise_minutes_this_week"] >= 60


@pytest.mark.asyncio
async def test_overview_travel_snapshot_reflected(auth_client):
    """여행 생성 후 overview.travel.total이 반영되어야 한다."""
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "대시보드 테스트 여행", "destination": "서울",
        "start_date": "2026-12-01", "end_date": "2026-12-03", "status": "planned",
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["travel"] is not None
    assert data["travel"]["total"] >= 1
    assert data["travel"]["upcoming"] >= 1


@pytest.mark.asyncio
async def test_overview_finance_reflected(auth_client):
    """재테크 기록 후 overview.finance.latest_total_assets가 반영되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01", "total_assets": 8888,
        "monthly_income": 500, "monthly_expense": 300,
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["finance"] is not None
    assert data["finance"]["latest_total_assets"] == 8888


@pytest.mark.asyncio
async def test_overview_travel_next_trip_reflected(auth_client):
    """예정된 여행 생성 후 overview.travel.next_trip_name이 반영되어야 한다."""
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "다음 여행지 방콕", "destination": "태국",
        "start_date": "2026-11-01", "end_date": "2026-11-05", "status": "planned",
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["travel"] is not None
    assert data["travel"]["next_trip_name"] == "다음 여행지 방콕"
    assert data["travel"]["next_trip_destination"] == "태국"


@pytest.mark.asyncio
async def test_overview_career_reflected(auth_client):
    """CF 레이팅 기록 후 overview.career.latest_cf_rating이 반영되어야 한다."""
    await auth_client.put("/api/v1/career/settings", json={"cf_handle": "testcoder"})
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-06-01", "rating": 1800, "rank_name": "master",
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["career"] is not None
    assert data["career"]["cf_handle"] == "testcoder"
    assert data["career"]["latest_cf_rating"] == 1800


@pytest.mark.asyncio
async def test_overview_health_exercise_streak_reflected(auth_client):
    """연속 운동 후 overview.health.exercise_streak이 반영되어야 한다."""
    from datetime import date, timedelta
    today = date.today()
    for i in range(3):
        d = (today - timedelta(days=2 - i)).isoformat()
        await auth_client.post("/api/v1/health/exercise", json={
            "log_date": d, "exercise_type": "러닝", "duration_minutes": 30,
        })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["health"] is not None
    assert data["health"]["exercise_streak"] >= 3


@pytest.mark.asyncio
async def test_overview_finance_asset_change_reflected(auth_client):
    """2개 재테크 기록 후 overview.finance.asset_change가 반영되어야 한다."""
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-04-01", "total_assets": 4000,
        "monthly_income": 300, "monthly_expense": 200,
    })
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-05-01", "total_assets": 4500,
        "monthly_income": 350, "monthly_expense": 200,
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["finance"] is not None
    assert data["finance"]["asset_change"] == 500


@pytest.mark.asyncio
async def test_overview_career_rating_delta_reflected(auth_client):
    """두 번 CF 레이팅 기록 후 overview.career.rating_delta가 반영되어야 한다."""
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-03-01", "rating": 1500, "rank_name": "specialist",
    })
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-05-01", "rating": 1700, "rank_name": "expert",
    })
    resp = await auth_client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["career"] is not None
    assert data["career"]["rating_delta"] == 200
