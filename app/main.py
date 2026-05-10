from fastapi import FastAPI

from app.core.config import settings

def create_app() -> FastAPI:
    """FastAPI 앱 팩토리 - 테스트/실행 분리를 위한 패턴"""
    app = FastAPI(
        tile=settings.app_name,
        debug=settings.debug,
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.app_name}
    
    return app

app = create_app()