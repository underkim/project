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
    # 데이터가 없어도 헤더 행은 반환되어야 한다 (BOM 포함)
    assert resp.content.startswith("﻿".encode("utf-8"))
    content = resp.content.decode("utf-8-sig")
    header_line = content.splitlines()[0]
    assert "날짜" in header_line
    assert "총자산(만원)" in header_line
    assert "메모" in header_line
    # 데이터 행은 없어야 한다 (헤더만)
    assert len([ln for ln in content.splitlines() if ln.strip()]) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("path,expected_header", [
    ("/api/v1/export/finance", "날짜"),
    ("/api/v1/export/health/exercise", "운동종류"),
    ("/api/v1/export/health/sleep", "수면시간(시간)"),
    ("/api/v1/export/growth/books", "제목"),
    ("/api/v1/export/growth/english", "활동종류"),
    ("/api/v1/export/career", "레이팅"),
    ("/api/v1/export/travel", "여행명"),
])
async def test_export_empty_includes_header(auth_client, path, expected_header):
    """모든 export 엔드포인트는 데이터가 없어도 헤더 행을 반환해야 한다."""
    resp = await auth_client.get(path)
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    lines = [ln for ln in content.splitlines() if ln.strip()]
    assert len(lines) == 1  # 헤더만
    assert expected_header in lines[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("path,expected_headers", [
    ("/api/v1/export/finance", ["날짜", "총자산(만원)", "월수입(만원)", "월지출(만원)", "저축액(만원)", "저축률(%)", "메모"]),
    ("/api/v1/export/health/exercise", ["날짜", "운동종류", "시간(분)", "메모"]),
    ("/api/v1/export/health/sleep", ["날짜", "수면시간(시간)", "품질(1-5)", "메모"]),
    ("/api/v1/export/growth/books", ["제목", "저자", "상태", "시작일", "완료일", "평점", "메모"]),
    ("/api/v1/export/growth/english", ["날짜", "활동종류", "시간(분)", "메모"]),
    ("/api/v1/export/career", ["날짜", "레이팅", "랭크"]),
    ("/api/v1/export/travel", ["여행명", "목적지", "시작일", "종료일", "상태", "체크리스트", "일정", "맛집", "메모"]),
])
async def test_export_headers_are_readable_korean(auth_client, path, expected_headers):
    """CSV 헤더가 utf-8-sig 디코딩 후 정상 한글로 읽혀야 한다 (mojibake 회귀 방지)."""
    resp = await auth_client.get(path)
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    header_line = content.splitlines()[0]
    cols = header_line.split(",")
    assert cols == expected_headers


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


@pytest.mark.asyncio
async def test_export_travel_includes_plan_and_checklist(auth_client):
    """여행 export에 일정·체크리스트 내용이 포함되어야 한다."""
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "방콕 여행", "destination": "태국",
        "start_date": "2026-10-01", "end_date": "2026-10-05",
    })).json()
    trip_id = trip["id"]

    await auth_client.post(f"/api/v1/travel/trips/{trip_id}/plan", json={
        "day": 1, "title": "왓 프라깨우 관광", "time": "10:00",
    })
    await auth_client.post(f"/api/v1/travel/trips/{trip_id}/checklist", json={
        "text": "선크림 챙기기",
    })

    resp = await auth_client.get("/api/v1/export/travel")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "방콕 여행" in content
    assert "왓 프라깨우 관광" in content
    assert "선크림 챙기기" in content


@pytest.mark.asyncio
async def test_export_travel_includes_restaurants_excludes_coords(auth_client):
    """여행 export 맛집 컬럼에 이름·분류·방문여부가 포함되고 좌표는 빠져야 한다."""
    trip = (await auth_client.post("/api/v1/travel/trips", json={
        "name": "오사카 여행", "destination": "일본",
        "start_date": "2026-11-01", "end_date": "2026-11-04",
    })).json()
    trip_id = trip["id"]

    await auth_client.post(f"/api/v1/travel/trips/{trip_id}/restaurants", json={
        "name": "이치란 라멘", "cuisine": "라멘", "is_visited": True,
        "latitude": 34.6687, "longitude": 135.5012,
    })

    resp = await auth_client.get("/api/v1/export/travel")
    assert resp.status_code == 200
    content = resp.content.decode("utf-8-sig")
    assert "이치란 라멘" in content
    assert "라멘" in content
    # 좌표(지도 표시용 내부 필드)는 CSV에 노출되지 않아야 한다.
    assert "34.6687" not in content
    assert "135.5012" not in content
