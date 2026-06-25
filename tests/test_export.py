"""CSV 내보내기 엔드포인트 통합 테스트."""
import pytest


@pytest.mark.asyncio
async def test_export_routes_registered(app):
    paths = {r.path for r in app.routes}
    assert "/api/v1/export/finance" in paths
    assert "/api/v1/export/health/exercise" in paths
    assert "/api/v1/export/health/sleep" in paths
    assert "/api/v1/export/growth/books" in paths
    assert "/api/v1/export/growth/english" in paths
    assert "/api/v1/export/career" in paths
    assert "/api/v1/export/travel" in paths


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [
    "/api/v1/export/finance",
    "/api/v1/export/health/exercise",
    "/api/v1/export/health/sleep",
    "/api/v1/export/growth/books",
    "/api/v1/export/growth/english",
    "/api/v1/export/career",
    "/api/v1/export/travel",
])
async def test_export_requires_auth(client, path):
    resp = await client.get(path)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_finance_empty(auth_client):
    resp = await auth_client.get("/api/v1/export/finance")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    # 데이터 없으면 BOM만 반환
    assert resp.content == "﻿".encode("utf-8")


@pytest.mark.asyncio
async def test_export_finance_with_data(auth_client):
    # 데이터 삽입
    await auth_client.post("/api/v1/finance/records", json={
        "record_date": "2026-06-01",
        "total_assets": 5000,
        "monthly_income": 300,
        "monthly_expense": 200,
    })

    resp = await auth_client.get("/api/v1/export/finance")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")  # BOM 제거
    assert "날짜" in content
    assert "총자산(만원)" in content
    assert "2026-06-01" in content
    assert "5000" in content


@pytest.mark.asyncio
async def test_export_exercise_with_data(auth_client):
    await auth_client.post("/api/v1/health/exercise", json={
        "log_date": "2026-06-10",
        "exercise_type": "러닝",
        "duration_minutes": 30,
    })

    resp = await auth_client.get("/api/v1/export/health/exercise")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "날짜" in content
    assert "운동종류" in content
    assert "러닝" in content


@pytest.mark.asyncio
async def test_export_sleep_with_data(auth_client):
    await auth_client.post("/api/v1/health/sleep", json={
        "log_date": "2026-06-10",
        "sleep_hours": 7.5,
        "quality": 4,
    })

    resp = await auth_client.get("/api/v1/export/health/sleep")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "수면시간(시간)" in content
    assert "7.5" in content


@pytest.mark.asyncio
async def test_export_books_with_data(auth_client):
    await auth_client.post("/api/v1/growth/books", json={
        "title": "파이썬 마스터",
        "status": "reading",
    })

    resp = await auth_client.get("/api/v1/export/growth/books")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "제목" in content
    assert "파이썬 마스터" in content


@pytest.mark.asyncio
async def test_export_english_with_data(auth_client):
    await auth_client.post("/api/v1/growth/english", json={
        "log_date": "2026-06-10",
        "activity_type": "단어 암기",
        "duration_minutes": 20,
    })

    resp = await auth_client.get("/api/v1/export/growth/english")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "활동종류" in content
    assert "단어 암기" in content


@pytest.mark.asyncio
async def test_export_career_with_data(auth_client):
    await auth_client.post("/api/v1/career/cf-ratings", json={
        "log_date": "2026-06-10",
        "rating": 1500,
        "rank_name": "specialist",
    })

    resp = await auth_client.get("/api/v1/export/career")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "레이팅" in content
    assert "1500" in content
    assert "specialist" in content


@pytest.mark.asyncio
async def test_export_travel_with_data(auth_client):
    await auth_client.post("/api/v1/travel/trips", json={
        "name": "제주 여행",
        "destination": "제주도",
        "start_date": "2026-08-01",
        "end_date": "2026-08-03",
    })

    resp = await auth_client.get("/api/v1/export/travel")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "여행명" in content
    assert "제주 여행" in content


@pytest.mark.asyncio
async def test_export_content_disposition_filename(auth_client):
    resp = await auth_client.get("/api/v1/export/finance")
    disposition = resp.headers["content-disposition"]
    assert "finance.csv" in disposition
