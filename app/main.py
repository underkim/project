from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.health import router as health_router
from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.career.router import router as career_router
from app.modules.travel.router import router as travel_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.finance.router import router as finance_router
from app.modules.growth.router import router as growth_router
from app.modules.health.router import router as health_module_router
from app.modules.planner.router import router as planner_router
from app.modules.ai.router import router as ai_router
from app.modules.export.router import router as export_router
from app.modules.devstatus.router import router as devstatus_router


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(auth_router)
    app.include_router(planner_router)
    app.include_router(finance_router)
    app.include_router(health_module_router)
    app.include_router(growth_router)
    app.include_router(career_router)
    app.include_router(travel_router)
    app.include_router(dashboard_router)
    app.include_router(ai_router)
    app.include_router(export_router)

    # 탈부착 가능한 모듈: ENABLE_DEVSTATUS_MODULE=false 로 비활성화 가능 (코드 변경 불필요)
    if settings.enable_devstatus_module:
        app.include_router(devstatus_router)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # 라우트 자체가 매칭되지 않을 때 Starlette가 내리는 기본 영문 "Not Found"만
        # 앱 전역 톤(한국어, 내부 정보 노출 없음)에 맞게 치환한다. 각 라우터가 이미
        # 의미 있는 detail을 설정한 404(및 다른 상태 코드)는 그대로 통과시킨다.
        if exc.status_code == 404 and exc.detail in (None, "Not Found"):
            return JSONResponse(status_code=404, content={"detail": "요청하신 API 경로를 찾을 수 없습니다."})
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)

    return app

app = create_app()
