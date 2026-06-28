from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.modules.auth.service import authenticate
from app.core.config import settings
from app.core.security import create_access_token


def test_authenticate_success():
    result = authenticate(settings.admin_username, settings.admin_password)
    assert result is not None
    assert result.token_type == "bearer"
    assert len(result.access_token) > 0


def test_authenticate_wrong_password():
    result = authenticate(settings.admin_username, "wrongpassword")
    assert result is None


def test_authenticate_wrong_username():
    result = authenticate("nobody", settings.admin_password)
    assert result is None


def test_auth_routes_registered(app):
    routes = {route.path for route in app.routes}
    assert "/api/v1/auth/token" in routes


# ── TASK-047: 세션 수명주기 계약 검증 ──────────────────────────────────


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    """로그인 엔드포인트는 비밀번호 오류 시 401을 반환한다 (만료와 구분되는 신호)."""
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "wrongpassword"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_expired_token_returns_401(client):
    """만료된 토큰으로 보호된 라우트 접근 시 401."""
    expired = jwt.encode(
        {"sub": settings.admin_username, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    resp = await client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {expired}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_malformed_token_returns_401(client):
    """변조·잘못된 형식의 토큰은 401."""
    resp = await client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": "Bearer not-a-real-jwt"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_wrong_secret_token_returns_401(client):
    """다른 시크릿으로 서명된 토큰은 401 (서명 검증)."""
    forged = jwt.encode(
        {"sub": settings.admin_username,
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        "attacker-secret",
        algorithm=settings.jwt_algorithm,
    )
    resp = await client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {forged}"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_valid_token_accesses_protected_route(client):
    """유효한 토큰은 보호된 라우트에 접근 가능하다."""
    token = create_access_token(settings.admin_username)
    resp = await client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_error_response_does_not_leak_token(client):
    """401 응답 본문에 토큰 값이 노출되지 않아야 한다."""
    token = "Bearer-secret-token-value-1234567890"
    resp = await client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
    assert token not in resp.text
