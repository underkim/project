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


async def test_health_returns_200(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


async def test_health_returns_correct_payload(client):
    response = await client.get("/api/v1/health")
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Life Dashboard"
