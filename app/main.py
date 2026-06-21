from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

    return app

app = create_app()
