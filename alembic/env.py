import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.models import Base
from app.core.config import settings

target_metadata = Base.metadata

# SQLite(aiosqlite)는 동기 드라이버로, PostgreSQL(asyncpg)는 async로 처리
_url = settings.database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url.replace("+aiosqlite", "").replace("+asyncpg", ""),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(_url, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    if _url.startswith("sqlite"):
        # SQLite: aiosqlite 제거 후 동기 엔진
        from sqlalchemy import engine_from_config
        sync_url = _url.replace("+aiosqlite", "")
        cfg = config.get_section(config.config_ini_section, {})
        cfg["sqlalchemy.url"] = sync_url
        connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
        with connectable.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    else:
        # PostgreSQL: asyncpg 그대로 사용
        asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
