from scripts.self_host_preflight import validate_config


VALID = {
    "JWT_SECRET": "a" * 64,
    "ADMIN_PASSWORD": "personal-password-123",
    "POSTGRES_PASSWORD": "database-password-123",
    "CORS_ORIGINS": "http://localhost:3000,https://life.example.com",
    "NEXT_PUBLIC_API_URL": "https://api.life.example.com",
}


def test_valid_self_host_config():
    assert validate_config(VALID) == []


def test_placeholders_and_short_secrets_are_rejected():
    errors = validate_config({
        **VALID,
        "JWT_SECRET": "CHANGE_ME",
        "ADMIN_PASSWORD": "short",
        "POSTGRES_PASSWORD": "CHANGE_ME_PASSWORD",
    })
    assert len(errors) == 3
    assert all("CHANGE_ME" not in error for error in errors)


def test_invalid_origins_and_api_url_are_rejected():
    errors = validate_config({
        **VALID,
        "CORS_ORIGINS": "https://example.com/path",
        "NEXT_PUBLIC_API_URL": "api",
    })
    assert any("CORS_ORIGINS" in error for error in errors)
    assert any("NEXT_PUBLIC_API_URL" in error for error in errors)


def test_secret_values_are_not_returned_in_errors():
    secret = "very-secret-but-short"
    errors = validate_config({**VALID, "JWT_SECRET": secret[:10]})
    assert errors
    assert all(secret not in error for error in errors)
