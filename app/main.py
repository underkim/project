from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.core.config import settings

def create_app() -> FastAPI:
    """FastAPI 앱 팩토리 - 테스트/실행 분리를 위한 패턴"""
    app = FastAPI(
        tile=settings.app_name,
        debug=settings.debug,
    )

    app.include_router(health_router, prefix="/api/v1")
    
    return app

app = create_app()