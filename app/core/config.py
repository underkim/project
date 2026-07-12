import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """애플리케이션 환경설정 - .env 파일에서 자동 로드"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 앱 메타
    app_name: str = "Life Dashboard"
    debug: bool = False

    # DB
    database_url: str = "sqlite+aiosqlite:///./lifedash.db"

    # JWT
    jwt_secret: str = "change-me-in-production-use-env-var"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1주일

    # 단일 사용자 인증
    admin_username: str = "admin"
    admin_password: str = "password"

    # CORS (쉼표 구분 문자열 → 리스트)
    cors_origins: str = "http://localhost:3000"

    # AI
    gemini_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

# 기본 비밀값 사용 시 경고
if settings.jwt_secret == "change-me-in-production-use-env-var":
    warnings.warn("⚠️  JWT_SECRET이 기본값입니다. .env에서 안전한 값으로 변경하세요.", stacklevel=1)
if settings.admin_password == "password":
    warnings.warn("⚠️  ADMIN_PASSWORD가 기본값(password)입니다. .env에서 변경하세요.", stacklevel=1)
