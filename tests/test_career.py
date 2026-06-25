from datetime import date

import pytest
from pydantic import ValidationError
from app.modules.career.schemas import CFRatingLogCreate, CareerSettingsUpdate


def test_cf_rating_rejects_negative():
    with pytest.raises(ValidationError):
        CFRatingLogCreate(log_date=date(2026, 1, 1), rating=-1, rank_name="specialist")


def test_cf_rating_allows_zero():
    log = CFRatingLogCreate(log_date=date(2026, 1, 1), rating=0, rank_name="newbie")
    assert log.rating == 0


def test_cf_rank_name_cannot_be_empty():
    with pytest.raises(ValidationError):
        CFRatingLogCreate(log_date=date(2026, 1, 1), rating=1500, rank_name="  ")


def test_career_settings_rejects_empty_handle():
    with pytest.raises(ValidationError):
        CareerSettingsUpdate(cf_handle="")


def test_career_settings_rejects_blank_username():
    with pytest.raises(ValidationError):
        CareerSettingsUpdate(github_username="   ")


def test_career_settings_allows_none_to_clear():
    s = CareerSettingsUpdate(cf_handle=None)
    assert s.cf_handle is None


def test_career_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/career/settings" in routes
    assert "/api/v1/career/cf-ratings" in routes
    assert "/api/v1/career/summary" in routes


def test_dashboard_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/dashboard/overview" in routes


@pytest.mark.asyncio
async def test_career_settings_update_and_clear(auth_client):
    resp = await auth_client.put("/api/v1/career/settings", json={"cf_handle": "tourist"})
    assert resp.status_code == 200
    assert resp.json()["cf_handle"] == "tourist"

    # null 전송 시 필드가 지워져야 함
    resp2 = await auth_client.put("/api/v1/career/settings", json={"cf_handle": None})
    assert resp2.status_code == 200
    assert resp2.json()["cf_handle"] is None


@pytest.mark.asyncio
async def test_create_and_delete_cf_rating(auth_client):
    resp = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-04-01", "rating": 1500, "rank_name": "specialist",
    })
    assert resp.status_code == 201
    log_id = resp.json()["id"]
    assert resp.json()["rating"] == 1500

    del_resp = await auth_client.delete(f"/api/v1/career/cf-ratings/{log_id}")
    assert del_resp.status_code == 204
