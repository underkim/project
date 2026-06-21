import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import create_app

# 모든 모델 임포트 — Base.metadata.create_all이 테이블을 인식하도록
import app.core.models  # noqa: F401
import app.modules.finance.models  # noqa: F401
import app.modules.health.models  # noqa: F401
import app.modules.growth.models  # noqa: F401
import app.modules.career.models  # noqa: F401
import app.modules.travel.models  # noqa: F401

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
def app(db_engine):
    _app = create_app()

    async def _override_get_db():
        factory = async_sessionmaker(
            db_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        async with factory() as session:
            yield session

    _app.dependency_overrides[get_db] = _override_get_db
    return _app


@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_client(app):
    """로그인된 클라이언트 — Authorization 헤더 자동 첨부."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/auth/token",
            data={"username": "admin", "password": "password"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 200, f"로그인 실패: {resp.text}"
        token = resp.json()["access_token"]
        ac.headers["Authorization"] = f"Bearer {token}"
        yield ac
