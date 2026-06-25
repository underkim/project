import pytest
from datetime import date
from pydantic import ValidationError
from app.modules.career.schemas import CFRatingLogCreate


def test_cf_rating_rejects_negative():
    with pytest.raises(ValidationError):
        CFRatingLogCreate(log_date=date(2026, 1, 1), rating=-1, rank_name="specialist")


def test_cf_rating_allows_zero():
    log = CFRatingLogCreate(log_date=date(2026, 1, 1), rating=0, rank_name="newbie")
    assert log.rating == 0


def test_cf_rank_name_cannot_be_empty():
    with pytest.raises(ValidationError):
        CFRatingLogCreate(log_date=date(2026, 1, 1), rating=1500, rank_name="  ")


def test_career_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/career/settings" in routes
    assert "/api/v1/career/cf-ratings" in routes
    assert "/api/v1/career/summary" in routes


def test_dashboard_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/dashboard/overview" in routes
