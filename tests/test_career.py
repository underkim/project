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
async def test_career_settings_get(auth_client):
    """설정 조회 시 기본값 반환 (데이터 없어도 200)."""
    resp = await auth_client.get("/api/v1/career/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "cf_handle" in data
    assert "github_username" in data


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


@pytest.mark.asyncio
async def test_career_summary_reflects_latest_rating(auth_client):
    await auth_client.put("/api/v1/career/settings", json={
        "cf_handle": "coder123", "github_username": "dev_user",
    })
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-05-01", "rating": 1700, "rank_name": "expert",
    })
    resp = await auth_client.get("/api/v1/career/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cf_handle"] == "coder123"
    assert data["latest_cf_rating"] == 1700
    assert data["latest_cf_rank"] == "expert"


@pytest.mark.asyncio
async def test_delete_cf_rating_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/career/cf-ratings/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_cf_rating_negative_returns_422(auth_client):
    """음수 레이팅은 422여야 한다."""
    resp = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-06-01", "rating": -1, "rank_name": "newbie",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cf_rating_list_returns_200(auth_client):
    resp = await auth_client.get("/api/v1/career/cf-ratings")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_update_career_settings_blank_handle_returns_422(auth_client):
    """cf_handle을 공백 문자열로 수정하면 422여야 한다 (null을 써야 함)."""
    resp = await auth_client.put("/api/v1/career/settings", json={"cf_handle": "   "})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_cf_rating_blank_rank_returns_422(auth_client):
    """rank_name이 공백이면 422여야 한다."""
    resp = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-07-01", "rating": 1500, "rank_name": "  ",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_career_settings_update_and_clear_blog_url(auth_client):
    """blog_url 설정 → null로 지우기가 가능해야 한다."""
    resp = await auth_client.put("/api/v1/career/settings", json={"blog_url": "https://myblog.com"})
    assert resp.status_code == 200
    assert resp.json()["blog_url"] == "https://myblog.com"

    resp2 = await auth_client.put("/api/v1/career/settings", json={"blog_url": None})
    assert resp2.status_code == 200
    assert resp2.json()["blog_url"] is None


@pytest.mark.asyncio
async def test_career_settings_blank_blog_url_returns_422(auth_client):
    """blog_url을 공백 문자열로 설정하면 422여야 한다."""
    resp = await auth_client.put("/api/v1/career/settings", json={"blog_url": "   "})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_career_settings_get_returns_all_fields(auth_client):
    """설정 조회 시 cf_handle, github_username, blog_url 모두 포함되어야 한다."""
    resp = await auth_client.get("/api/v1/career/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "cf_handle" in data
    assert "github_username" in data
    assert "blog_url" in data


@pytest.mark.asyncio
async def test_cf_ratings_ordered_newest_first(auth_client):
    """CF 레이팅 목록은 최신 날짜 순으로 반환되어야 한다."""
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-01-01", "rating": 1200, "rank_name": "pupil",
    })
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-06-01", "rating": 1500, "rank_name": "specialist",
    })
    resp = await auth_client.get("/api/v1/career/cf-ratings")
    assert resp.status_code == 200
    ratings = resp.json()
    assert len(ratings) >= 2
    assert ratings[0]["log_date"] > ratings[1]["log_date"]


@pytest.mark.asyncio
async def test_cf_rating_multiple_same_day_allowed(auth_client):
    """같은 날짜에 CF 레이팅 기록을 2개 이상 저장할 수 있어야 한다."""
    r1 = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-05-15", "rating": 1500, "rank_name": "specialist",
    })
    r2 = await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-05-15", "rating": 1520, "rank_name": "specialist",
    })
    assert r1.status_code == 201
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_career_summary_no_ratings_returns_null(auth_client):
    """CF 레이팅 기록이 없을 때 summary의 레이팅 필드는 None이어야 한다."""
    resp = await auth_client.get("/api/v1/career/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["latest_cf_rating"] is None
    assert data["latest_cf_rank"] is None


@pytest.mark.asyncio
async def test_cf_rating_list_pagination(auth_client):
    """limit 파라미터로 CF 레이팅 목록 페이지네이션이 동작해야 한다."""
    for i in range(1, 6):
        await auth_client.post("/api/v1/career/cf-ratings", json={
            "log_date": f"2026-0{i}-01", "rating": 1400 + i * 10, "rank_name": "specialist",
        })
    resp = await auth_client.get("/api/v1/career/cf-ratings?limit=3")
    assert resp.status_code == 200
    assert len(resp.json()) == 3
