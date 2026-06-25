from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.modules.planner.schemas import ItemStatus, PhaseUpdate, RoadmapItemCreate, RoadmapItemUpdate
from app.modules.planner.service import _item_status, _phase_start
from app.core.models import Phase


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
