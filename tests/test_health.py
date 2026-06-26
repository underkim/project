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
async def test_update_sleep_note_and_quality(auth_client):
    create = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-05-01", "sleep_hours": 6.5, "quality": 3, "note": "초기 메모",
    })
    assert create.status_code == 201
    log_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/health/sleep/{log_id}", json={"quality": 5, "note": None})
    assert update.status_code == 200
    assert update.json()["quality"] == 5
    assert update.json()["note"] is None
    assert update.json()["sleep_hours"] == 6.5  # 변경하지 않은 필드 유지


@pytest.mark.asyncio
async def test_update_exercise_type_and_duration(auth_client):
    create = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-10", "exercise_type": "수영", "duration_minutes": 30,
    })
    assert create.status_code == 201
    log_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/health/exercise/{log_id}", json={
        "exercise_type": "러닝", "duration_minutes": 45,
    })
    assert update.status_code == 200
    assert update.json()["exercise_type"] == "러닝"
    assert update.json()["duration_minutes"] == 45
    assert update.json()["log_date"] == "2026-06-10"  # 변경하지 않은 필드 유지


@pytest.mark.asyncio
async def test_delete_sleep_log(auth_client):
    create = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-15", "sleep_hours": 7.0, "quality": 4,
    })
    assert create.status_code == 201
    log_id = create.json()["id"]

    del_resp = await auth_client.delete(f"/api/v1/health/sleep/{log_id}")
    assert del_resp.status_code == 204

    logs = (await auth_client.get("/api/v1/health/sleep")).json()
    assert all(l["id"] != log_id for l in logs)


@pytest.mark.asyncio
async def test_create_sleep_duplicate_date_returns_409(auth_client):
    payload = {"log_date": "2026-06-01", "sleep_hours": 7.0, "quality": 4}
    resp1 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert resp1.status_code == 201
    resp2 = await auth_client.post("/api/v1/health/sleep", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_update_exercise_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/health/exercise/99999", json={"duration_minutes": 30})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_sleep_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/health/sleep/99999", json={"quality": 3})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_exercise_invalid_duration_returns_422(auth_client):
    """duration_minutes = 0 이면 422여야 한다."""
    resp = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-20", "exercise_type": "러닝", "duration_minutes": 0,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_sleep_invalid_quality_returns_422(auth_client):
    """quality가 범위(1~5) 벗어나면 422여야 한다."""
    resp = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-20", "sleep_hours": 7.0, "quality": 6,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_exercise_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/health/exercise/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_sleep_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/health/sleep/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_sleep_invalid_quality_returns_422(auth_client):
    """수면 품질 범위(1~5) 벗어난 값으로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-07-01", "sleep_hours": 7.0, "quality": 4,
    })
    log_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/health/sleep/{log_id}", json={"quality": 0})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_exercise_invalid_duration_returns_422(auth_client):
    """운동 시간 0분 이하로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-07-02", "exercise_type": "줄넘기", "duration_minutes": 20,
    })
    log_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/health/exercise/{log_id}", json={"duration_minutes": -1})
    assert resp.status_code == 422


async def test_health_returns_200(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


async def test_health_returns_correct_payload(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Life Dashboard"
