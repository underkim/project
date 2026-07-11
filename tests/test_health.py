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


@pytest.mark.asyncio
async def test_sleep_list_returns_list(auth_client):
    """수면 기록 목록이 리스트로 반환되어야 한다."""
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-01", "sleep_hours": 7.5, "quality": 4,
    })
    resp = await auth_client.get("/api/v1/health/sleep")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1
    assert resp.json()[0]["sleep_hours"] == 7.5


@pytest.mark.asyncio
async def test_health_summary_reflects_sleep(auth_client):
    """이번 주 수면 기록이 summary에 반영되어야 한다."""
    from datetime import date
    today = date.today().isoformat()
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": today, "sleep_hours": 8.0, "quality": 5,
    })
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["avg_sleep_hours_this_week"] is not None
    assert data["avg_sleep_hours_this_week"] == 8.0
    assert data["avg_sleep_quality_this_week"] == 5.0


@pytest.mark.asyncio
async def test_create_sleep_invalid_sleep_hours_returns_422(auth_client):
    """수면 시간이 0이거나 24를 초과하면 422여야 한다."""
    resp_zero = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-09-01", "sleep_hours": 0, "quality": 3,
    })
    assert resp_zero.status_code == 422

    resp_over = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-09-02", "sleep_hours": 25, "quality": 3,
    })
    assert resp_over.status_code == 422


@pytest.mark.asyncio
async def test_create_sleep_future_date_returns_422(auth_client):
    """미래 날짜로 수면 기록을 생성하면 422여야 한다."""
    from datetime import timedelta
    future_date = (date.today() + timedelta(days=1)).isoformat()
    resp = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": future_date, "sleep_hours": 7.0, "quality": 3,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_sleep_today_date_is_allowed(auth_client):
    """오늘 날짜로는 정상적으로 생성돼야 한다 (미래만 거부)."""
    resp = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": date.today().isoformat(), "sleep_hours": 7.0, "quality": 3,
    })
    assert resp.status_code == 201


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["limit=0", "limit=201", "offset=-1"])
async def test_exercise_list_pagination_out_of_range_returns_422(auth_client, query):
    resp = await auth_client.get(f"/api/v1/health/exercise?{query}")
    assert resp.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["limit=0", "limit=201", "offset=-1"])
async def test_sleep_list_pagination_out_of_range_returns_422(auth_client, query):
    resp = await auth_client.get(f"/api/v1/health/sleep?{query}")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_sleep_invalid_hours_returns_422(auth_client):
    """수면 시간을 0 또는 25로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-03", "sleep_hours": 7.0, "quality": 3,
    })
    log_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/health/sleep/{log_id}", json={"sleep_hours": 0})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_health_summary_empty_db(auth_client):
    """데이터 없을 때 summary는 0과 None을 반환해야 한다."""
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["exercise_days_this_week"] == 0
    assert data["total_exercise_minutes_this_week"] == 0
    assert data["avg_sleep_hours_this_week"] is None
    assert data["avg_sleep_quality_this_week"] is None


@pytest.mark.asyncio
async def test_exercise_multiple_same_day_allowed(auth_client):
    """같은 날짜에 서로 다른 운동을 여러 번 기록할 수 있어야 한다."""
    r1 = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-25", "exercise_type": "러닝", "duration_minutes": 30,
    })
    r2 = await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-25", "exercise_type": "수영", "duration_minutes": 45,
    })
    assert r1.status_code == 201
    assert r2.status_code == 201
    logs = (await auth_client.get("/api/v1/health/exercise")).json()
    same_day = [e for e in logs if e["log_date"] == "2026-06-25"]
    assert len(same_day) == 2


@pytest.mark.asyncio
async def test_exercise_list_ordered_newest_first(auth_client):
    """운동 기록 목록은 최신 날짜 순으로 반환되어야 한다."""
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-01-01", "exercise_type": "걷기", "duration_minutes": 20,
    })
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-01", "exercise_type": "러닝", "duration_minutes": 30,
    })
    resp = await auth_client.get("/api/v1/health/exercise")
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) >= 2
    assert logs[0]["log_date"] > logs[1]["log_date"]


@pytest.mark.asyncio
async def test_sleep_list_ordered_newest_first(auth_client):
    """수면 기록 목록은 최신 날짜 순으로 반환되어야 한다."""
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-01-10", "sleep_hours": 6.0, "quality": 3,
    })
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-10", "sleep_hours": 8.0, "quality": 5,
    })
    resp = await auth_client.get("/api/v1/health/sleep")
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) >= 2
    assert logs[0]["log_date"] > logs[1]["log_date"]


@pytest.mark.asyncio
async def test_exercise_streak_consecutive_days(auth_client):
    """연속으로 운동한 날짜가 있으면 summary에 exercise_streak이 반영되어야 한다."""
    from datetime import date, timedelta
    today = date.today()
    for i in range(3):
        d = (today - timedelta(days=2 - i)).isoformat()
        await auth_client.post("/api/v1/health/exercise", json={
            "log_date": d, "exercise_type": "러닝", "duration_minutes": 30,
        })
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["exercise_streak"] >= 3


@pytest.mark.asyncio
async def test_exercise_streak_broken_resets(auth_client):
    """3일 연속 후 하루 쉬면 스트릭이 끊어져야 한다."""
    from datetime import date, timedelta
    today = date.today()
    for i in [4, 3, 2]:
        d = (today - timedelta(days=i)).isoformat()
        await auth_client.post("/api/v1/health/exercise", json={
            "log_date": d, "exercise_type": "헬스", "duration_minutes": 40,
        })
    resp = await auth_client.get("/api/v1/health/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["exercise_streak"] == 0
