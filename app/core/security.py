from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def create_access_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": sub, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        sub: str | None = payload.get("sub")
        if sub is None:
            raise ValueError
        return sub
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
