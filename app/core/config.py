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

    # AI
    gemini_api_key: str = ""

settings = Settings()
