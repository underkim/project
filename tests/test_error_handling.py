import pytest


@pytest.mark.asyncio
async def test_unmatched_route_returns_sanitized_korean_404(client):
    resp = await client.get("/api/v1/this-route-does-not-exist")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "요청하신 API 경로를 찾을 수 없습니다."}


@pytest.mark.asyncio
async def test_router_specific_404_detail_is_preserved(auth_client):
    resp = await auth_client.get("/api/v1/finance/records/999999")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "재테크 기록을 찾을 수 없습니다."}


@pytest.mark.asyncio
async def test_unauthenticated_401_keeps_www_authenticate_header(client):
    resp = await client.get("/api/v1/finance/records")
    assert resp.status_code == 401
    assert resp.headers.get("www-authenticate") == "Bearer"
