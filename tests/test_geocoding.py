"""Travel 지오코딩 회복력 단위 테스트 (Nominatim 호출 모킹).

TASK-045: 타임아웃·무결과·레이트리밋 시 None을 반환하고(비치명적),
동일 주소 반복 요청은 캐시로 외부 호출을 막는지 검증한다.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.modules.travel import geocoding


@pytest.fixture(autouse=True)
def _clear_cache():
    """각 테스트 전후로 모듈 캐시를 비워 상호 간섭을 막는다."""
    geocoding._cache.clear()
    yield
    geocoding._cache.clear()


def _client_returning(resp_mock):
    """async context manager로 동작하는 httpx.AsyncClient mock 생성."""
    client = MagicMock()
    client.get = AsyncMock(return_value=resp_mock)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm, client


@pytest.mark.asyncio
async def test_geocode_empty_address_returns_none():
    assert await geocoding.geocode(None) is None
    assert await geocoding.geocode("   ") is None


@pytest.mark.asyncio
async def test_geocode_success_returns_coords():
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=[{"lat": "37.5665", "lon": "126.9780"}])
    cm, _ = _client_returning(resp)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        result = await geocoding.geocode("서울시청")
    assert result == (37.5665, 126.9780)


@pytest.mark.asyncio
async def test_geocode_no_result_returns_none():
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=[])
    cm, _ = _client_returning(resp)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        assert await geocoding.geocode("존재하지않는주소XYZ") is None


@pytest.mark.asyncio
async def test_geocode_timeout_returns_none():
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
    cm.__aexit__ = AsyncMock(return_value=False)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        assert await geocoding.geocode("서울시청") is None


@pytest.mark.asyncio
async def test_geocode_rate_limit_returns_none():
    """429 응답(raise_for_status가 예외)은 None으로 흡수된다."""
    resp = MagicMock()
    resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("429", request=MagicMock(), response=MagicMock())
    )
    cm, _ = _client_returning(resp)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        assert await geocoding.geocode("서울시청") is None


@pytest.mark.asyncio
async def test_geocode_caches_repeated_address():
    """동일 주소 두 번 호출 시 외부 요청은 한 번만 발생한다."""
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=[{"lat": "35.1796", "lon": "129.0756"}])
    cm, client = _client_returning(resp)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        r1 = await geocoding.geocode("부산역")
        r2 = await geocoding.geocode("부산역")  # 대소문자/공백 정규화 동일 키
        r3 = await geocoding.geocode("  부산역  ")
    assert r1 == r2 == r3 == (35.1796, 129.0756)
    assert client.get.await_count == 1


@pytest.mark.asyncio
async def test_geocode_caches_no_result():
    """무결과(None)도 캐시되어 재요청하지 않는다."""
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(return_value=[])
    cm, client = _client_returning(resp)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        assert await geocoding.geocode("없는주소ABC") is None
        assert await geocoding.geocode("없는주소ABC") is None
    assert client.get.await_count == 1


@pytest.mark.asyncio
async def test_geocode_timeout_not_cached():
    """일시적 오류(타임아웃)는 캐시하지 않아 다음 시도에서 재요청한다."""
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
    cm.__aexit__ = AsyncMock(return_value=False)
    with patch.object(geocoding.httpx, "AsyncClient", return_value=cm):
        assert await geocoding.geocode("서울시청") is None
    # 캐시에 남지 않아야 한다.
    assert geocoding._cache_key("서울시청") not in geocoding._cache
