"""Health·Finance·Growth·Career 모듈 DB 통합 테스트."""
import pytest


# ── Health ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_exercise(auth_client):
    resp = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-20", "exercise_type": "수영", "duration_minutes": 45,
    })
    assert resp.status_code == 201
    assert resp.json()["exercise_type"] == "수영"

    list_resp = await auth_client.get("/api/v1/health/exercise")
    assert any(e["exercise_type"] == "수영" for e in list_resp.json())


@pytest.mark.asyncio
async def test_delete_exercise(auth_client):
    created = (await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-19", "exercise_type": "사이클", "duration_minutes": 60,
    })).json()
    resp = await auth_client.delete(f"/api/v1/health/exercise/{created['id']}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_create_and_list_sleep(auth_client):
    resp = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-20", "sleep_hours": 7.5, "quality": 4,
    })
    assert resp.status_code == 201
    assert resp.json()["sleep_hours"] == 7.5

    list_resp = await auth_client.get("/api/v1/health/sleep")
    assert any(s["log_date"] == "2026-06-20" for s in list_resp.json())


@pytest.mark.asyncio
async def test_sleep_unique_constraint(auth_client):
    """같은 날짜 수면 기록 중복 불가."""
    payload = {"log_date": "2026-06-18", "sleep_hours": 6.0, "quality": 3}
    r1 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert r1.status_code == 201
    r2 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_health_summary(auth_client):
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-21", "exercise_type": "러닝", "duration_minutes": 30,
    })
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    assert "exercise_days_this_week" in resp.json()


# ── Finance ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_finance(auth_client):
    resp = await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01",
        "total_assets": 5000,
        "monthly_income": 400,
        "monthly_expense": 250,
    })
    assert resp.status_code == 201
    assert resp.json()["total_assets"] == 5000

    summary = await auth_client.get("/api/v1/finance/summary")
    assert summary.status_code == 200
    assert summary.json()["latest_total_assets"] == 5000


@pytest.mark.asyncio
async def test_update_finance_record(auth_client):
    created = (await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-04-01", "total_assets": 4000, "monthly_income": 350, "monthly_expense": 200,
    })).json()
    resp = await auth_client.put(f"/api/v1/finance/records/{created['id']}", json={"total_assets": 4500})
    assert resp.status_code == 200
    assert resp.json()["total_assets"] == 4500
    assert resp.json()["monthly_income"] == 350  # 변경하지 않은 필드 유지


@pytest.mark.asyncio
async def test_delete_finance_record(auth_client):
    created = (await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-05-01", "total_assets": 3000, "monthly_income": 300, "monthly_expense": 200,
    })).json()
    resp = await auth_client.delete(f"/api/v1/finance/records/{created['id']}")
    assert resp.status_code == 204


# ── Growth ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_book(auth_client):
    resp = await auth_client.post("/api/v1/growth/books", json={
        "title": "파친코", "author": "이민진", "status": "completed",
    })
    assert resp.status_code == 201
    assert resp.json()["title"] == "파친코"

    books = (await auth_client.get("/api/v1/growth/books")).json()
    assert any(b["title"] == "파친코" for b in books)


@pytest.mark.asyncio
async def test_update_book_status(auth_client):
    """독서 상태를 planned → reading → completed로 변경할 수 있어야 한다."""
    created = (await auth_client.post("/api/v1/growth/books", json={
        "title": "클린 코드", "status": "planned",
    })).json()
    book_id = created["id"]

    resp = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={
        "status": "reading", "start_date": "2026-06-01",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reading"
    assert data["start_date"] == "2026-06-01"

    resp2 = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={
        "status": "completed", "end_date": "2026-06-25",
    })
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "completed"
    assert resp2.json()["end_date"] == "2026-06-25"


@pytest.mark.asyncio
async def test_create_english_log(auth_client):
    resp = await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-06-21", "activity_type": "listening", "duration_minutes": 20,
    })
    assert resp.status_code == 201
    assert resp.json()["activity_type"] == "listening"


@pytest.mark.asyncio
async def test_growth_summary(auth_client):
    await auth_client.post("/api/v1/growth/books", json={"title": "책1", "status": "completed"})
    resp = await auth_client.get("/api/v1/growth/summary")
    assert resp.status_code == 200
    assert "books_completed_this_year" in resp.json()


# ── Career ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_list_cf_rating(auth_client):
    resp = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-06-01", "rating": 1500, "rank_name": "specialist",
    })
    assert resp.status_code == 201
    assert resp.json()["rating"] == 1500

    ratings = (await auth_client.get("/api/v1/career/cf-ratings")).json()
    assert any(r["rating"] == 1500 for r in ratings)


@pytest.mark.asyncio
async def test_career_settings_update(auth_client):
    resp = await auth_client.put("/api/v1/career/settings", json={
        "cf_handle": "tourist", "github_username": "donghun",
    })
    assert resp.status_code == 200
    assert resp.json()["cf_handle"] == "tourist"


@pytest.mark.asyncio
async def test_career_settings_clear_field(auth_client):
    """cf_handle을 설정 후 null로 지울 수 있어야 한다."""
    await auth_client.put("/api/v1/career/settings", json={"cf_handle": "tourist"})
    resp = await auth_client.put("/api/v1/career/settings", json={"cf_handle": None})
    assert resp.status_code == 200
    assert resp.json()["cf_handle"] is None
