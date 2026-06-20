import pytest
import jwt
from app.core.security import create_access_token
from app.core.config import settings


def test_create_access_token_returns_valid_jwt():
    token = create_access_token(sub="admin")
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "admin"


def test_invalid_token_raises():
    from fastapi import HTTPException
    import asyncio
    from app.core.security import get_current_user

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_current_user("invalid.token.here"))
    assert exc_info.value.status_code == 401
