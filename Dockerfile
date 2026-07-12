FROM python:3.12-slim

WORKDIR /app

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# 의존성 파일 먼저 복사 (레이어 캐싱)
COPY pyproject.toml uv.lock ./

# 프로덕션 의존성 설치
RUN uv sync --frozen --no-dev

# 앱 코드 복사
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini alembic.ini
COPY scripts/self_host_preflight.py scripts/self_host_preflight.py

EXPOSE 8000

# 마이그레이션 후 서버 시작
CMD ["sh", "-c", "uv run python scripts/self_host_preflight.py && uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
