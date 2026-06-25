import pytest
from pydantic import ValidationError
from app.modules.growth.schemas import BookRecordCreate, BookRecordUpdate, BookStatus, EnglishLogCreate


def test_book_default_status_is_planned():
    book = BookRecordCreate(title="테스트 책")
    assert book.status == BookStatus.planned


def test_book_rating_must_be_1_to_5():
    with pytest.raises(ValidationError):
        BookRecordCreate(title="책", rating=6)


def test_book_update_rating_must_be_1_to_5():
    with pytest.raises(ValidationError):
        BookRecordUpdate(rating=0)
    with pytest.raises(ValidationError):
        BookRecordUpdate(rating=6)


def test_book_title_cannot_be_empty():
    with pytest.raises(ValidationError):
        BookRecordCreate(title="   ")


def test_book_title_is_stripped():
    book = BookRecordCreate(title="  파친코  ")
    assert book.title == "파친코"


def test_book_create_end_before_start_rejected():
    from datetime import date
    with pytest.raises(ValidationError):
        BookRecordCreate(title="책", start_date=date(2026, 3, 10), end_date=date(2026, 3, 1))


def test_book_update_end_before_start_rejected():
    from datetime import date
    with pytest.raises(ValidationError):
        BookRecordUpdate(start_date=date(2026, 3, 10), end_date=date(2026, 3, 1))


def test_english_activity_type_cannot_be_empty():
    with pytest.raises(ValidationError):
        EnglishLogCreate(log_date="2026-01-01", activity_type="", duration_minutes=30)


def test_english_log_duration_must_be_positive():
    with pytest.raises(ValidationError):
        EnglishLogCreate(log_date="2026-01-01", activity_type="reading", duration_minutes=0)


def test_growth_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/growth/books" in routes
    assert "/api/v1/growth/english" in routes
    assert "/api/v1/growth/summary" in routes


@pytest.mark.asyncio
async def test_update_book_status(auth_client):
    create = await auth_client.post("/api/v1/growth/books", json={"title": "파친코"})
    assert create.status_code == 201
    book_id = create.json()["id"]
    assert create.json()["status"] == "planned"

    update = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={"status": "reading"})
    assert update.status_code == 200
    assert update.json()["status"] == "reading"
    assert update.json()["title"] == "파친코"


@pytest.mark.asyncio
async def test_update_english_log(auth_client):
    create = await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-04-01", "activity_type": "듣기", "duration_minutes": 30,
    })
    assert create.status_code == 201
    log_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/growth/english/{log_id}", json={"duration_minutes": 45})
    assert update.status_code == 200
    assert update.json()["duration_minutes"] == 45
    assert update.json()["activity_type"] == "듣기"


@pytest.mark.asyncio
async def test_delete_book(auth_client):
    create = await auth_client.post("/api/v1/growth/books", json={"title": "삭제할 책", "status": "planned"})
    assert create.status_code == 201
    book_id = create.json()["id"]

    del_resp = await auth_client.delete(f"/api/v1/growth/books/{book_id}")
    assert del_resp.status_code == 204

    books = (await auth_client.get("/api/v1/growth/books")).json()
    assert all(b["id"] != book_id for b in books)


@pytest.mark.asyncio
async def test_delete_english_log(auth_client):
    create = await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-06-05", "activity_type": "writing", "duration_minutes": 20,
    })
    assert create.status_code == 201
    log_id = create.json()["id"]

    del_resp = await auth_client.delete(f"/api/v1/growth/english/{log_id}")
    assert del_resp.status_code == 204

    logs = (await auth_client.get("/api/v1/growth/english")).json()
    assert all(l["id"] != log_id for l in logs)


@pytest.mark.asyncio
async def test_growth_summary_reflects_reading_books(auth_client):
    await auth_client.post("/api/v1/growth/books", json={"title": "완독 책", "status": "reading"})
    resp = await auth_client.get("/api/v1/growth/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["books_reading"] >= 1
