import pytest
from pydantic import ValidationError
from app.modules.growth.schemas import BookRecordCreate, BookStatus, EnglishLogCreate


def test_book_default_status_is_planned():
    book = BookRecordCreate(title="테스트 책")
    assert book.status == BookStatus.planned


def test_book_rating_must_be_1_to_5():
    with pytest.raises(ValidationError):
        BookRecordCreate(title="책", rating=6)


def test_english_log_duration_must_be_positive():
    with pytest.raises(ValidationError):
        EnglishLogCreate(log_date="2026-01-01", activity_type="reading", duration_minutes=0)


def test_growth_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/growth/books" in routes
    assert "/api/v1/growth/english" in routes
    assert "/api/v1/growth/summary" in routes
