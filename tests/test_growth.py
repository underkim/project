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
async def test_update_book_invalid_date_range_returns_422(auth_client):
    """end_date를 start_date보다 이전으로 부분 업데이트하면 422여야 한다."""
    from datetime import date
    create = await auth_client.post("/api/v1/growth/books", json={
        "title": "날짜 검증 책", "start_date": "2026-06-01",
    })
    assert create.status_code == 201
    book_id = create.json()["id"]

    resp = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={"end_date": "2026-05-01"})
    assert resp.status_code == 422


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


@pytest.mark.asyncio
async def test_update_book_clears_nullable_fields(auth_client):
    """note, author를 null로 전송하면 필드가 지워져야 한다."""
    create = await auth_client.post("/api/v1/growth/books", json={
        "title": "nullable 테스트 책", "author": "저자명", "note": "메모",
    })
    assert create.status_code == 201
    book_id = create.json()["id"]

    update = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={"author": None, "note": None})
    assert update.status_code == 200
    assert update.json()["author"] is None
    assert update.json()["note"] is None
    assert update.json()["title"] == "nullable 테스트 책"  # 다른 필드 유지


@pytest.mark.asyncio
async def test_update_book_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/growth/books/99999", json={"status": "reading"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_english_not_found_returns_404(auth_client):
    resp = await auth_client.put("/api/v1/growth/english/99999", json={"duration_minutes": 30})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_book_empty_title_returns_422(auth_client):
    resp = await auth_client.post("/api/v1/growth/books", json={"title": "   "})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_book_invalid_rating_returns_422(auth_client):
    """평점이 1~5 범위 밖이면 422여야 한다."""
    resp = await auth_client.post("/api/v1/growth/books", json={"title": "테스트 책", "rating": 6})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_english_zero_duration_returns_422(auth_client):
    resp = await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-06-15", "activity_type": "reading", "duration_minutes": 0,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_book_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/growth/books/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_english_not_found_returns_404(auth_client):
    resp = await auth_client.delete("/api/v1/growth/english/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_english_invalid_duration_returns_422(auth_client):
    """영어 학습 시간 0 이하로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-07-01", "activity_type": "reading", "duration_minutes": 30,
    })
    log_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/growth/english/{log_id}", json={"duration_minutes": 0})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_book_invalid_rating_returns_422(auth_client):
    """도서 평점 범위(1~5) 벗어난 값으로 수정하면 422여야 한다."""
    create = await auth_client.post("/api/v1/growth/books", json={"title": "평점 검증 책"})
    book_id = create.json()["id"]
    resp = await auth_client.put(f"/api/v1/growth/books/{book_id}", json={"rating": 6})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_book_list_returns_list(auth_client):
    """도서 목록 조회 시 리스트가 반환되어야 한다."""
    await auth_client.post("/api/v1/growth/books", json={"title": "목록 테스트 책", "author": "저자"})
    resp = await auth_client.get("/api/v1/growth/books")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1
    assert resp.json()[0]["title"] == "목록 테스트 책"


@pytest.mark.asyncio
async def test_english_list_returns_list(auth_client):
    """영어 학습 목록 조회 시 리스트가 반환되어야 한다."""
    await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-08-01", "activity_type": "읽기", "duration_minutes": 25,
    })
    resp = await auth_client.get("/api/v1/growth/english")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_growth_summary_reflects_english(auth_client):
    """영어 학습 기록이 이번 달 summary에 반영되어야 한다."""
    from datetime import date
    today = date.today().isoformat()
    await auth_client.post("/api/v1/growth/english", json={
        "log_date": today, "activity_type": "listening", "duration_minutes": 40,
    })
    resp = await auth_client.get("/api/v1/growth/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["english_days_this_month"] >= 1
    assert data["english_minutes_this_month"] >= 40


@pytest.mark.asyncio
async def test_growth_summary_books_accuracy(auth_client):
    """올해 완독한 책과 독서 중인 책이 summary에 정확히 반영되어야 한다."""
    from datetime import date
    this_year = str(date.today().year)

    await auth_client.post("/api/v1/growth/books", json={
        "title": "완독 책 A", "status": "completed",
        "start_date": f"{this_year}-01-01", "end_date": f"{this_year}-02-01",
    })
    await auth_client.post("/api/v1/growth/books", json={
        "title": "완독 책 B", "status": "completed",
        "start_date": f"{this_year}-03-01", "end_date": f"{this_year}-04-01",
    })
    await auth_client.post("/api/v1/growth/books", json={
        "title": "읽는 중 책", "status": "reading",
    })

    resp = await auth_client.get("/api/v1/growth/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["books_completed_this_year"] >= 2
    assert data["books_reading"] >= 1
