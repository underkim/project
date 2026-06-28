"""주소 → 좌표 지오코딩 (Nominatim / OpenStreetMap, API 키 불필요).

best-effort: 실패하거나 결과가 없으면 None을 반환한다. 호출 측은 좌표 없이도
여행/맛집을 저장할 수 있어야 한다. 사용자가 입력한 주소만 전송한다
(메모·체크리스트·일정 등 다른 데이터는 절대 전송하지 않음).

동일 주소에 대한 반복 요청을 막기 위해 프로세스 메모리에 작은 LRU 캐시를 둔다
(Nominatim 사용 정책상 동일 쿼리 반복 호출은 피하는 것이 바람직).
"""
from __future__ import annotations

from collections import OrderedDict

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim 사용 정책상 식별 가능한 User-Agent 필요
_HEADERS = {"User-Agent": "LifeDashboard/1.0 (travel map geocoding)"}

# 주소(정규화) → (lat, lon) | None 결과 캐시. None(미해결)도 캐시해 재요청을 막는다.
_CACHE_MAX = 256
_cache: "OrderedDict[str, tuple[float, float] | None]" = OrderedDict()


def _cache_key(address: str) -> str:
    return " ".join(address.strip().lower().split())


def _cache_get(key: str):
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    return _MISS


def _cache_put(key: str, value: tuple[float, float] | None) -> None:
    _cache[key] = value
    _cache.move_to_end(key)
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


# 캐시 미스를 None(미해결 결과)과 구분하기 위한 센티넬
_MISS = object()


async def geocode(address: str | None) -> tuple[float, float] | None:
    """주소를 (latitude, longitude)로 변환. 실패 시 None.

    동일 주소는 캐시된 결과를 재사용해 외부 요청을 반복하지 않는다.
    """
    if not address or not address.strip():
        return None

    key = _cache_key(address)
    cached = _cache_get(key)
    if cached is not _MISS:
        return cached

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                _NOMINATIM_URL,
                params={"q": address.strip(), "format": "json", "limit": 1},
                headers=_HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
        if not data:
            _cache_put(key, None)
            return None
        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            result = (lat, lon)
            _cache_put(key, result)
            return result
        _cache_put(key, None)
        return None
    except Exception:
        # 네트워크/파싱 오류는 무시 — 좌표 없이 저장 진행.
        # 일시적 오류(타임아웃·레이트리밋)일 수 있으므로 캐시에 저장하지 않는다.
        return None
