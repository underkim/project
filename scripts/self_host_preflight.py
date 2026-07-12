"""Validate self-hosted Docker configuration without printing secret values."""

from collections.abc import Mapping
import os
from urllib.parse import urlparse


def validate_config(env: Mapping[str, str]) -> list[str]:
    errors: list[str] = []
    jwt_secret = env.get("JWT_SECRET", "")
    admin_password = env.get("ADMIN_PASSWORD", "")
    postgres_password = env.get("POSTGRES_PASSWORD", "")

    if len(jwt_secret) < 32 or "CHANGE_ME" in jwt_secret.upper():
        errors.append("JWT_SECRET must be a unique random value of at least 32 characters")
    if len(admin_password) < 12 or "CHANGE_ME" in admin_password.upper():
        errors.append("ADMIN_PASSWORD must be a unique value of at least 12 characters")
    if len(postgres_password) < 16 or "CHANGE_ME" in postgres_password.upper():
        errors.append("POSTGRES_PASSWORD must be a unique value of at least 16 characters")

    origins = [item.strip() for item in env.get("CORS_ORIGINS", "").split(",") if item.strip()]
    if not origins:
        errors.append("CORS_ORIGINS must contain at least one browser origin")
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
            errors.append("CORS_ORIGINS must contain only full http(s) origins without paths")
            break

    api_url = env.get("NEXT_PUBLIC_API_URL", "")
    parsed_api = urlparse(api_url)
    if parsed_api.scheme not in {"http", "https"} or not parsed_api.netloc:
        errors.append("NEXT_PUBLIC_API_URL must be a full http(s) URL reachable by the browser")
    return errors


def main() -> int:
    errors = validate_config(os.environ)
    if errors:
        print("Self-host configuration is not ready:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Self-host configuration validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
