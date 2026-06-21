import secrets

from app.core.config import settings
from app.core.security import create_access_token
from app.modules.auth.schemas import TokenResponse


def authenticate(username: str, password: str) -> TokenResponse | None:
    ok = secrets.compare_digest(username, settings.admin_username) and \
         secrets.compare_digest(password, settings.admin_password)
    if not ok:
        return None
    token = create_access_token(sub=username)
    return TokenResponse(access_token=token)
