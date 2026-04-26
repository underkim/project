# ADR-0003: SQLAlchemy 2.0 Async + asyncpg

- 상태: 채택
- 일자: 2026-04-26

## 맥락

Life Dashboard는 FastAPI 기반이며, ADR-0002에서 결정한 BFF 패턴은 다수의 DB 호출을 `asyncio.gather`로 병렬 실행하는 것을 전제로 한다.

이를 위해 ORM(SQLAlchemy)과 DB 드라이버를 동기·비동기 중 어떤 조합으로 쓸 것인지 결정해야 한다.

## 선택지

### 1. 동기 SQLAlchemy + psycopg2

전통적인 조합. FastAPI는 동기 함수를 별도 스레드 풀에서 실행한다.

- 장점: 자료·예제 풍부, 디버깅 쉬움
- 단점: 비동기 엔드포인트 안에서 동기 DB 호출 시 스레드 블로킹. `asyncio.gather`의 병렬성 효과가 제한됨

### 2. SQLAlchemy 2.0 Async + asyncpg

SQLAlchemy 2.0의 비동기 API + 비동기 PostgreSQL 드라이버.

- 장점: FastAPI의 async 흐름과 자연스럽게 맞물림. 진정한 병렬 DB I/O 가능 (BFF 핵심 요구사항)
- 단점: 동기 ORM 대비 자료 적음, 일부 패턴(lazy loading 등) 사용 제약

### 3. 비동기 ORM 대안 (Tortoise ORM, SQLModel 등)

- 장점: 비동기 우선 설계
- 단점: SQLAlchemy 대비 생태계 작음, 마이그레이션 도구·문서 빈약

## 결정

**SQLAlchemy 2.0 Async + asyncpg + Alembic** 을 채택한다.

```python
# core/database.py
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@host/db",
    pool_size=10,
    max_overflow=5,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,  # 비동기 세션 권장 설정
    class_=AsyncSession,
)
```

## 구현 규칙

### 의존성 주입

```python
# core/database.py
async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session

# planner/router.py
@router.get("/items")
async def list_items(session: AsyncSession = Depends(get_session)):
    return await planner_service.list_items(session)
```

### Lazy Loading 금지

비동기 컨텍스트에서 lazy loading은 추가 쿼리를 트리거할 때 예외를 발생시킨다. 관계 로딩은 명시적으로:

```python
# 권장
stmt = select(Phase).options(selectinload(Phase.categories))

# 금지 (lazy loading)
phase = await session.get(Phase, 1)
phase.categories  # ← MissingGreenlet 예외 가능
```

### 세션 수명

- 요청당 하나의 세션 (DI로 주입)
- service layer는 세션을 인자로 받음 (자체 생성 X)
- 트랜잭션은 service layer에서 관리 (`async with session.begin():`)

### 마이그레이션

- Alembic은 동기 환경에서 동작 → 마이그레이션 스크립트는 동기 엔진 사용
- 운영 코드만 비동기, 마이그레이션은 별도

## 근거

- **BFF 패턴 전제** — `asyncio.gather`로 모듈별 service를 병렬 실행하는데, 내부 DB 호출이 동기면 스레드 블로킹으로 병렬성이 무너진다
- **SQLAlchemy 2.0 성숙도** — 2023년 출시 이후 비동기 API가 안정화. 동기 API와 거의 동등한 표현력
- **PostgreSQL 결정 동반** — asyncpg는 PG 전용 비동기 드라이버 중 가장 빠르고 안정적
- **Alembic 호환** — 마이그레이션은 SQLAlchemy 생태계 표준 도구를 그대로 사용

## 결과

### 장점

- BFF 집계 엔드포인트가 진정한 병렬 DB I/O로 동작
- FastAPI 전반의 async 흐름과 일관성
- 동기 ORM의 표현력 대부분 유지

### 단점 / 주의

- Lazy loading 사용 불가 → 관계 로딩 전략을 코드 작성 시점에 결정해야 함
- 세션 누수 시 비동기 환경 디버깅이 동기보다 까다로움
- 일부 서드파티 라이브러리가 동기 세션을 가정 → 호환성 확인 필요

## 관련 문서

- [ADR-0001 Modular Monolith](./0001-modular-monolith.md)
- [ADR-0002 BFF 패턴](./0002-bff-pattern.md)
- [architecture/data-model.md](../architecture/data-model.md)