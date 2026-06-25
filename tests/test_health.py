from datetime import date

import pytest
from pydantic import ValidationError
from app.modules.health.schemas import ExerciseLogCreate


def test_exercise_type_cannot_be_empty():
    with pytest.raises(ValidationError):
        ExerciseLogCreate(log_date="2026-01-01", exercise_type="  ", duration_minutes=30)


def test_exercise_type_is_stripped():
    log = ExerciseLogCreate(log_date="2026-01-01", exercise_type=" 러닝 ", duration_minutes=30)
    assert log.exercise_type == "러닝"


def test_exercise_duration_must_be_positive():
    with pytest.raises(ValidationError):
        ExerciseLogCreate(log_date="2026-01-01", exercise_type="러닝", duration_minutes=0)


@pytest.mark.asyncio
async def test_create_and_delete_exercise(auth_client):
    payload = {"log_date": "2026-04-01", "exercise_type": "러닝", "duration_minutes": 30}
    resp = await auth_client.post("/api/v1/health/exercise", json=payload)
    assert resp.status_code == 201
    log_id = resp.json()["id"]
    assert resp.json()["exercise_type"] == "러닝"

    del_resp = await auth_client.delete(f"/api/v1/health/exercise/{log_id}")
    assert del_resp.status_code == 204

    list_resp = await auth_client.get("/api/v1/health/exercise")
    assert all(e["id"] != log_id for e in list_resp.json())


@pytest.mark.asyncio
async def test_health_summary_reflects_exercise(auth_client):
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": date.today().isoformat(), "exercise_type": "수영", "duration_minutes": 45,
    })
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["exercise_days_this_week"] >= 1
    assert data["total_exercise_minutes_this_week"] >= 45


@pytest.mark.asyncio
async def test_create_sleep_duplicate_date_returns_409(auth_client):
    payload = {"log_date": "2026-06-01", "sleep_hours": 7.0, "quality": 4}
    resp1 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert resp1.status_code == 201
    resp2 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert resp2.status_code == 409


async def test_health_returns_200(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


async def test_health_returns_correct_payload(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Life Dashboard"
