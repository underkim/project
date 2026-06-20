from app.core.config import settings
from app.core.security import create_access_token
from app.modules.auth.schemas import TokenResponse


def authenticate(username: str, password: str) -> TokenResponse | None:
    if username != settings.admin_username or password != settings.admin_password:
        return None
    token = create_access_token(sub=username)
    return TokenResponse(access_token=token)
