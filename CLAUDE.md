# CLAUDE.md — Life Dashboard

## 프로젝트 개요

5년 라이프 로드맵을 4개 도메인(커리어·재테크·건강·자기계발)으로 관리하는 FastAPI 백엔드.
단일 사용자 기준, 학습 목적 겸 포트폴리오 프로젝트.

## 기술 스택

- **Python 3.12+**, 패키지 관리: `uv` (`pyproject.toml` + `uv.lock`)
- **FastAPI** + **uvicorn** (ASGI)
- **SQLAlchemy 2.0 async** + **asyncpg** (PostgreSQL 드라이버)
- **Alembic** (마이그레이션)
- **pydantic-settings** (환경설정, `.env` 자동 로드)
- **pytest** + **httpx** (테스트)
- **PyJWT** (JWT 인증)
- **python-multipart** (OAuth2 폼 데이터)


## 작업 방식 (효율 + 품질)

### 단계별 진행 원칙
- 한 번에 전체 기능 X → 스키마 → CRUD → 라우터 → 테스트 순서로 요청
- 코드 생성 후 바로 실행 전 "이 코드 문제 있으면 말해줘" 확인 단계 포함
- 에러 발생 시 트레이스백 전체를 컨텍스트에 포함

### 파일 참조 규칙
- 작업 관련 파일만 `@파일` 로 참조 (불필요한 파일 참조 금지)
- `.env` 파일은 절대 `@` 참조 금지
- 컨텍스트 길어지면 `/compact` → 필요시 `/clear`

### 코드 품질
- 기존 코드 스타일 유지: "~해줘, 단 기존 코드 스타일 유지"
- 새 기능 추가 시 테스트 파일도 함께 요청
- "이 코드 보안 취약점 있어?" 명시적으로 확인

### 보안 규칙
- `.env`, `*.db`, `.venv`, `__pycache__` 는 `.claudeignore` 등록
- DB 쿼리는 항상 파라미터 바인딩 (SQL Injection 방지)
- 인증 관련 코드는 반드시 보안 검토 요청


## 명령어

```bash
# 서버 실행
uv run uvicorn app.main:app --reload

# 테스트
uv run pytest

# 마이그레이션
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "설명"
```

## 프로젝트 구조

```
project/
├── app/
│   ├── main.py              # FastAPI 앱 팩토리 (create_app)
│   ├── core/
│   │   ├── config.py        # Settings (pydantic-settings, .env 로드)
│   │   ├── database.py      # async 엔진·세션·Base·get_db DI
│   │   └── models.py        # Phase, Category, RoadmapItem, RoadmapSettings
│   ├── api/v1/
│   │   └── health.py        # GET /api/v1/health
│   ├── modules/             # 향후 기능 모듈 위치 (현재 비어 있음)
│   └── shared/              # 공통 유틸 (현재 비어 있음)
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 4bbb978ce5a7_create_roadmap_tables.py
├── tests/
│   ├── conftest.py          # TestClient fixture
│   └── test_health.py       # health 엔드포인트 테스트
└── docs/
    ├── adr/                 # 아키텍처 결정 기록
    ├── architecture/        # 데이터 모델, ASGI 흐름 문서
    └── requirements/        # 모듈별 요구사항
```

## 아키텍처 원칙 (ADR 요약)

### Modular Monolith (ADR-0001)
코드는 도메인(기능) 단위로 묶는다. 계획된 모듈 구조:

```
app/modules/
├── auth/        # JWT 인증
├── planner/     # 로드맵·Phase·Item 관리  ← 첫 번째 구현 대상
├── career/      # CF·GitHub·블로그 RSS
├── finance/     # 자산·저축률
├── health/      # 운동·수면
├── growth/      # 독서·영어
└── dashboard/   # 집계 BFF (read-only)
```

**모듈 간 통신 규칙**: 다른 모듈의 `service layer`만 호출한다. 다른 모듈의 model·repository를 직접 import하지 않는다.

### BFF 하이브리드 패턴 (ADR-0002)
- **홈 화면**: `dashboard` 모듈의 단일 집계 엔드포인트 (`GET /api/v1/dashboard/overview`)
- **상세 화면**: 각 모듈 API 직접 호출
- `dashboard`는 read-only. 자체 model 없이 다른 모듈 service만 호출
- 집계 시 `asyncio.gather(..., return_exceptions=True)` — 한 모듈 실패해도 나머지 응답

### SQLAlchemy 2.0 Async (ADR-0003)
- **Lazy loading 금지** — 비동기 컨텍스트에서 `MissingGreenlet` 예외 발생
- 관계 로딩은 `selectinload` / `joinedload` 명시 필수
- 세션은 요청당 1개, DI(`Depends(get_db)`)로 주입; service가 자체 생성 금지
- 트랜잭션은 service layer에서 `async with session.begin():` 관리
- Alembic 마이그레이션은 **동기** 엔진 사용 (alembic/env.py)

## 데이터 모델 (Planner)

```
RoadmapSettings (단일 row)
    └── start_date

Phase (4개)
    ├── order_index, months, color
    └── Category (Phase당 4개)
            ├── icon, title, subtitle
            └── RoadmapItem (N개)
                    ├── text, offset (float, Phase 시작 기준 오프셋 개월 수)
                    └── is_completed (bool)
```

**파생값 — DB에 저장하지 않음**:
- `Phase.start_date` = `RoadmapSettings.start_date + 이전 Phase들의 months 합`
- `Item.deadline` = `Phase.start_date + offset`
- `Item.status` = 완료 / 임박(≤30일) / 정상 / 지연

현재 모델(`app/core/models.py`)과 ADR-0005의 설계 사이에 일부 차이가 있다. ADR에는 `key`, `bg` 컬럼과 `RoadmapItem.order`가 있지만 실제 모델에는 없다. 구현 시 ADR을 목표 스펙으로 참고하되, 실제 모델 파일을 우선으로 한다.

## 알려진 문제

- [app/core/models.py:5](app/core/models.py) — `from core.database import Base` 가 `from app.core.database import Base`여야 함. alembic/env.py에서 sys.path를 조작해 우회하고 있으나, 앱 실행 컨텍스트에서 임포트 오류 가능성 있음.
- [app/main.py:9](app/main.py) — `FastAPI(tile=...)` 오타. `title=`이어야 함.
- `tests/conftest.py`의 `TestClient` fixture가 `tests/test_health.py`에서는 사용되지 않고 각 테스트가 독립적으로 `AsyncClient`를 생성하고 있어 fixture 중복 정의 상태.

## 현재 구현 상태

| 항목 | 상태 |
|------|------|
| FastAPI 앱 골격 (팩토리 패턴) | 완료 |
| `GET /api/v1/health` | 완료 |
| DB 설정 (async 엔진·세션·DI) | 완료 |
| Alembic 마이그레이션 (테이블 생성 + seed 데이터 + 도메인 테이블) | 완료 |
| Planner 모델 (Phase·Category·RoadmapItem·RoadmapSettings) | 완료 |
| Planner API (`GET /roadmap`, `GET/PUT /settings`, `PATCH /items/{id}/toggle`) | 완료 |
| Auth 모듈 (`POST /api/v1/auth/token`, JWT, 단일 사용자) | 완료 |
| Finance 모듈 (`/api/v1/finance/records` CRUD + `/summary`) | 완료 |
| Health 모듈 (`/api/v1/health/exercise` & `/sleep` CRUD + `/summary`) | 완료 |
| Growth 모듈 (`/api/v1/growth/books` & `/english` CRUD + `/summary`) | 완료 |
| Career 모듈 (`/api/v1/career/settings` + `/cf-ratings` CRUD + `/summary`) | 완료 |
| Dashboard 모듈 (`GET /api/v1/dashboard/overview` BFF 집계) | 완료 |
| 테스트 (27개, 순수 함수 + 스키마 검증 + 라우터 등록) | 완료 |

## 새 모듈 추가 패턴

각 모듈은 아래 구조를 따른다:

```
app/modules/<name>/
├── __init__.py
├── router.py    # APIRouter, prefix="/api/v1/<name>"
├── service.py   # 비즈니스 로직, AsyncSession을 인자로 받음
├── models.py    # SQLAlchemy 모델 (필요 시)
└── schemas.py   # Pydantic 요청/응답 스키마
```

`app/main.py`의 `create_app()`에서 `app.include_router()`로 등록.

## 환경변수

`.env` 파일 (pydantic-settings가 자동 로드):

```
APP_NAME=Life Dashboard
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@host/lifedash
```
