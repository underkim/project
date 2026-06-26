from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.modules.planner.schemas import ItemStatus, PhaseUpdate, RoadmapItemCreate, RoadmapItemUpdate
from app.modules.planner.service import _item_status, _phase_start
from app.core.models import Phase, Category


@pytest.fixture
async def planner_seed(db_engine):
    """테스트용 Phase + Category 삽입."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    phase_id = cat_id = None
    async with factory() as session:
        async with session.begin():
            phase = Phase(name="TestPhase", label="테스트 단계", order_index=1, months=12, color="blue")
            session.add(phase)
            await session.flush()
            cat = Category(phase_id=phase.id, icon="📌", title="테스트 카테고리", subtitle="", order_index=0)
            session.add(cat)
            await session.flush()
            phase_id, cat_id = phase.id, cat.id
    return {"phase_id": phase_id, "category_id": cat_id}


# --- 순수 함수 단위 테스트 (DB 불필요) ---

def test_item_status_completed():
    assert _item_status(date(2025, 1, 1), is_completed=True) == ItemStatus.completed


def test_item_status_overdue():
    assert _item_status(date(2020, 1, 1), is_completed=False) == ItemStatus.overdue


def test_item_status_urgent():
    today = date.today()
    from datetime import timedelta
    deadline = today + timedelta(days=10)
    assert _item_status(deadline, is_completed=False) == ItemStatus.urgent


def test_item_status_on_track():
    today = date.today()
    from datetime import timedelta
    deadline = today + timedelta(days=60)
    assert _item_status(deadline, is_completed=False) == ItemStatus.on_track


def test_item_status_none_when_no_deadline():
    assert _item_status(None, is_completed=False) is None


def test_phase_start_first_phase():
    phases = [
        Phase(order_index=1, months=12),
        Phase(order_index=2, months=12),
    ]
    start = _phase_start(date(2026, 1, 1), phases, target_order=1)
    assert start == date(2026, 1, 1)


def test_phase_start_second_phase():
    phases = [
        Phase(order_index=1, months=12),
        Phase(order_index=2, months=6),
    ]
    start = _phase_start(date(2026, 1, 1), phases, target_order=2)
    assert start == date(2027, 1, 1)


def test_roadmap_item_offset_non_negative():
    with pytest.raises(ValidationError):
        RoadmapItemCreate(category_id=1, text="항목", offset=-1.0)


def test_roadmap_item_update_offset_non_negative():
    with pytest.raises(ValidationError):
        RoadmapItemUpdate(offset=-0.5)


def test_roadmap_item_text_cannot_be_empty():
    with pytest.raises(ValidationError):
        RoadmapItemCreate(category_id=1, text="  ", offset=0.0)


def test_roadmap_item_text_is_stripped():
    item = RoadmapItemCreate(category_id=1, text=" 알고리즘 스터디 ", offset=1.0)
    assert item.text == "알고리즘 스터디"


def test_phase_update_months_must_be_positive():
    with pytest.raises(ValidationError):
        PhaseUpdate(months=0)


# --- 라우터 등록 확인 테스트 ---

def test_planner_routes_registered(app):
    """planner 라우터가 앱에 등록되어 있는지 경로 목록으로 확인."""
    routes = {route.path for route in app.routes}
    assert "/api/v1/planner/roadmap" in routes
    assert "/api/v1/planner/settings" in routes
    assert "/api/v1/planner/items/{item_id}/toggle" in routes


# --- HTTP 통합 테스트 ---

@pytest.mark.asyncio
async def test_roadmap_returns_empty_without_seed(auth_client):
    resp = await auth_client.get("/api/v1/planner/roadmap")
    assert resp.status_code == 200
    data = resp.json()
    assert "phases" in data
    assert data["phases"] == []


@pytest.mark.asyncio
async def test_settings_update_and_get(auth_client):
    resp = await auth_client.put("/api/v1/planner/settings", json={"start_date": "2026-01-01"})
    assert resp.status_code == 200
    assert resp.json()["start_date"] == "2026-01-01"

    get_resp = await auth_client.get("/api/v1/planner/settings")
    assert get_resp.status_code == 200
    assert get_resp.json()["start_date"] == "2026-01-01"


@pytest.mark.asyncio
async def test_toggle_nonexistent_item_returns_404(auth_client):
    resp = await auth_client.patch("/api/v1/planner/items/99999/toggle")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_and_toggle_item(auth_client, planner_seed):
    cat_id = planner_seed["category_id"]

    # 항목 생성
    create = await auth_client.post("/api/v1/planner/items", json={
        "category_id": cat_id, "text": "테스트 플래너 항목", "offset": 2.0,
    })
    assert create.status_code == 201
    item_id = create.json()["id"]
    assert create.json()["is_completed"] is False

    # 토글 — 완료 처리
    toggle = await auth_client.patch(f"/api/v1/planner/items/{item_id}/toggle")
    assert toggle.status_code == 200
    assert toggle.json()["is_completed"] is True

    # 다시 토글 — 미완료 복원
    toggle2 = await auth_client.patch(f"/api/v1/planner/items/{item_id}/toggle")
    assert toggle2.status_code == 200
    assert toggle2.json()["is_completed"] is False


@pytest.mark.asyncio
async def test_create_category_and_update_phase(auth_client, planner_seed):
    phase_id = planner_seed["phase_id"]

    # 카테고리 생성
    create = await auth_client.post("/api/v1/planner/categories", json={
        "phase_id": phase_id, "title": "새 카테고리", "icon": "🎯", "subtitle": "서브 타이틀",
    })
    assert create.status_code == 201
    cat_id = create.json()["id"]
    assert create.json()["title"] == "새 카테고리"

    # 카테고리 업데이트
    update = await auth_client.put(f"/api/v1/planner/categories/{cat_id}", json={"title": "수정된 카테고리"})
    assert update.status_code == 200
    assert update.json()["title"] == "수정된 카테고리"

    # Phase 업데이트 (색상 변경)
    phase_update = await auth_client.put(f"/api/v1/planner/phases/{phase_id}", json={"color": "green", "months": 6})
    assert phase_update.status_code == 200
    assert phase_update.json()["color"] == "green"
    assert phase_update.json()["months"] == 6

    # 카테고리 삭제
    del_resp = await auth_client.delete(f"/api/v1/planner/categories/{cat_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_update_and_delete_item(auth_client, planner_seed):
    cat_id = planner_seed["category_id"]

    create = await auth_client.post("/api/v1/planner/items", json={
        "category_id": cat_id, "text": "삭제할 항목", "offset": 1.0,
    })
    item_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/planner/items/{item_id}", json={"text": "수정된 항목", "offset": 3.0})
    assert update.status_code == 200
    assert update.json()["text"] == "수정된 항목"
    assert update.json()["offset"] == 3.0

    del_resp = await auth_client.delete(f"/api/v1/planner/items/{item_id}")
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_create_item_with_invalid_category_returns_404(auth_client):
    """존재하지 않는 category_id로 항목 생성 시 404여야 한다."""
    resp = await auth_client.post("/api/v1/planner/items", json={
        "category_id": 99999, "text": "유효하지 않은 카테고리", "offset": 1.0,
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_category_with_invalid_phase_returns_404(auth_client):
    """존재하지 않는 phase_id로 카테고리 생성 시 404여야 한다."""
    resp = await auth_client.post("/api/v1/planner/categories", json={
        "phase_id": 99999, "title": "유효하지 않은 Phase", "icon": "🎯",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_item_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/planner/items/99999", json={"text": "없는 항목"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_category_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/planner/categories/99999")
    assert resp.status_code == 404
