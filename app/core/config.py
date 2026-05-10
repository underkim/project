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

    # DB (추후 사용)
    database_url: str = "postgresql+asyncpg://localhost/lifedash"

settings = Settings()
