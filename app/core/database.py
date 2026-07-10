from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# 1. Engine - 앱당 1개 연결 풀 보유
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

# SQLite는 기본적으로 FK 제약(ON DELETE CASCADE 포함)을 강제하지 않는다.
# 로컬 개발 기본 DB가 SQLite(app/core/config.py)이므로 활성화하지 않으면
# 여행(trip) 등 부모 레코드 삭제 시 자식 레코드가 고아로 남는다.
# 프로덕션(Postgres)은 FK를 항상 강제하므로 영향 없음.
if engine.url.get_backend_name() == "sqlite":

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
    