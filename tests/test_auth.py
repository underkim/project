from app.modules.auth.service import authenticate
from app.core.config import settings


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
