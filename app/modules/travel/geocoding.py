"""주소 → 좌표 지오코딩 (Nominatim / OpenStreetMap, API 키 불필요).

best-effort: 실패하거나 결과가 없으면 None을 반환한다. 호출 측은 좌표 없이도
여행/맛집을 저장할 수 있어야 한다. 사용자가 입력한 주소만 전송한다
(메모·체크리스트·일정 등 다른 데이터는 절대 전송하지 않음).
"""
from __future__ import annotations

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim 사용 정책상 식별 가능한 User-Agent 필요
_HEADERS = {"User-Agent": "LifeDashboard/1.0 (travel map geocoding)"}


async def geocode(address: str | None) -> tuple[float, float] | None:
    """주소를 (latitude, longitude)로 변환. 실패 시 None."""
    if not address or not address.strip():
        return None
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
            return None
        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
        return None
    except Exception:
        # 네트워크/파싱 오류는 무시 — 좌표 없이 저장 진행
        return None
