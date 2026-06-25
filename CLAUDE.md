# CLAUDE.md — Life Dashboard

## 프로젝트 개요

5년 라이프 로드맵을 7개 도메인(플래너·재테크·건강·자기계발·커리어·여행·AI)으로 관리하는
풀스택 개인 대시보드. FastAPI 백엔드 + Next.js 프론트엔드, 단일 사용자 기준, 학습 목적 겸 포트폴리오.

**배포**: Render(백엔드) + Supabase(PostgreSQL) + Vercel(프론트엔드)  
**콜드 스타트 방지**: cron-job.org가 `/api/v1/health`를 14분마다 핑 (DB도 동시에 깨움)  
**구현 상태**: 모든 모듈 구현 및 프로덕션 배포 완료 (2026-06-25)

## 기술 스택

### 백엔드
- **Python 3.12+**, 패키지 관리: `uv` (`pyproject.toml` + `uv.lock`)
- **FastAPI** + **uvicorn** (ASGI)
- **SQLAlchemy 2.0 async** + **asyncpg** (PostgreSQL 드라이버)
- **Alembic** (마이그레이션 — asyncpg 직접 사용, psycopg2 의존 없음)
- **pydantic-settings** (환경설정, `.env` 자동 로드)
- **pytest** + **httpx** (테스트, 103개)
- **PyJWT** (JWT 인증)
- **python-multipart** (OAuth2 폼 데이터)
- **google-genai** (Gemini AI — **gemini-3.1-flash-lite** 모델)

### 프론트엔드
- **Next.js** (App Router, `frontend/`)
- **TypeScript**
- **Tailwind CSS**
- **axios** (API 클라이언트, JWT 인터셉터 포함)
- **recharts** (차트)
- **lucide-react** (아이콘)

## 명령어

```bash
# 백엔드 서버 실행
uv run uvicorn app.main:app --reload

# 프론트엔드 개발 서버
cd frontend && npm run dev   # http://localhost:3000

# 테스트 (103개)
uv run pytest

# 마이그레이션
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "설명"
```

## Claude Code 규칙

### 보안 (절대 위반 금지)
- `.env` 파일은 절대 읽거나 참조하지 않는다
- DB 쿼리는 항상 파라미터 바인딩 (SQL Injection 방지)
- 인증 관련 코드 변경 시 반드시 보안 검토
- `.env`, `*.db`, `.venv`, `__pycache__` 는 `.claudeignore` 등록 상태 유지

### 코드 작성 원칙
- 기존 코드 스타일을 유지한다 (파일을 먼저 읽고 패턴 파악 후 작성)
- 새 기능 추가 시 테스트도 함께 작성한다
- 기능 추가 없이 불필요한 리팩토링 금지 — 요청한 것만 변경
- 주석은 WHY가 비명백할 때만 작성, 코드 설명 주석 금지

### SQLAlchemy async 필수 규칙
- **Lazy loading 절대 금지** — 비동기에서 `MissingGreenlet` 발생
- 관계 로딩은 `selectinload` / `joinedload` 명시 필수
- 세션은 `Depends(get_db)`로 주입, service가 자체 세션 생성 금지
- 트랜잭션은 `async with session.begin():` 또는 `commit()`/`rollback()` 명시

### AI 서비스 한정 규칙
- `ai/service.py`의 `_create`/`_update`/`_delete` 내부에서 `session.begin()` 사용 금지 — 중첩 트랜잭션 오류
- 최상위에서 `await session.commit()` / `await session.rollback()` 으로 일괄 관리
- 다중 액션 시 `_create` 후 `await session.flush()` 필수 — 이후 액션이 해당 레코드를 조회할 수 있도록
- 타 모듈 service 대신 ORM 객체 직접 `session.add()` 사용 (트랜잭션 중첩 방지)

## 프로젝트 구조

```
project/
├── app/
│   ├── main.py              # FastAPI 앱 팩토리 (create_app)
│   ├── core/
│   │   ├── config.py        # Settings (pydantic-settings, .env 로드)
│   │   ├── database.py      # async 엔진·세션·Base·get_db DI
│   │   ├── models.py        # Phase, Category, RoadmapItem, RoadmapSettings
│   │   └── security.py      # JWT 생성·검증, get_current_user
│   ├── api/v1/
│   │   └── health.py        # GET /api/v1/health (DB ping 포함)
│   └── modules/
│       ├── auth/            # POST /api/v1/auth/token (JWT, secrets.compare_digest)
│       ├── planner/         # GET /roadmap, GET|PUT /settings, PATCH /items/{id}/toggle
│       ├── finance/         # /api/v1/finance/records CRUD + /summary
│       ├── health/          # /api/v1/health/exercise & /sleep CRUD + /summary
│       ├── growth/          # /api/v1/growth/books & /english CRUD + /summary
│       ├── career/          # /api/v1/career/settings + /cf-ratings CRUD + /summary
│       ├── travel/          # /api/v1/travel/trips CRUD + checklist + plan(일정)
│       ├── ai/              # /api/v1/ai/chat (Gemini 멀티턴), /execute (삭제 확인), /weekly-report
│       ├── dashboard/       # GET /api/v1/dashboard/overview (BFF 집계)
│       └── export/          # GET /api/v1/export/{module} (CSV 내보내기, 7개 엔드포인트)
├── alembic/
│   ├── env.py               # asyncpg 직접 사용 (asyncio.run + create_async_engine)
│   └── versions/
│       ├── 4bbb978ce5a7_create_roadmap_tables.py
│       ├── a1b2c3d4e5f6_seed_planner_data.py
│       ├── b2c3d4e5f6a7_create_domain_tables.py
│       ├── c3d4e5f6a7b8_create_travel_tables.py   # ON DELETE CASCADE 포함
│       └── 4fbe97fa41c1_add_trip_plan_items.py    # ON DELETE CASCADE 포함
├── tests/
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_planner.py
│   ├── test_finance.py
│   ├── test_growth.py
│   ├── test_career.py
│   ├── test_ai.py
│   └── test_travel.py
├── frontend/
│   ├── app/
│   │   ├── (auth)/          # 로그인 페이지
│   │   └── (dashboard)/
│   │       ├── layout.tsx   # Sidebar + AiModal(FAB) 레이아웃
│   │       ├── page.tsx     # 대시보드 홈 (overview)
│   │       ├── planner/     # 로드맵, Phase, 항목 관리 (다중 선택 삭제 + 마감일 피커)
│   │       ├── finance/
│   │       ├── health/
│   │       ├── growth/
│   │       ├── career/
│   │       ├── travel/      # 여행 CRUD + 체크리스트 탭 + 일정(plan) 탭
│   │       └── help/        # 인앱 가이드 & 매뉴얼 페이지
│   ├── components/
│   │   ├── AiModal.tsx      # AI 채팅 FAB 모달 (localStorage 이력, 삭제 확인, suggestions 칩, 복사 버튼)
│   │   ├── Sidebar.tsx      # 8개 메뉴 (대시보드~여행 + 가이드)
│   │   └── Toast.tsx
│   ├── hooks/
│   │   └── useAiRefresh.ts  # ai-data-saved 이벤트 구독 → 페이지 데이터 리프레시
│   ├── lib/
│   │   └── api.ts           # axios 클라이언트 (JWT 인터셉터) + 모듈별 API 함수
│   └── types/
│       └── index.ts         # 모든 TypeScript 인터페이스
└── docs/
    ├── deployment.md        # Render + Supabase + Vercel + cron-job.org 배포 가이드
    ├── adr/
    ├── architecture/
    └── requirements/
```

## 아키텍처 원칙 (ADR 요약)

### Modular Monolith (ADR-0001)
코드는 도메인(기능) 단위로 묶는다.

**모듈 간 통신 규칙**: 다른 모듈의 `service layer`만 호출한다. 다른 모듈의 model·repository를 직접 import하지 않는다.  
**예외**: `ai/service.py`는 트랜잭션 중첩 방지를 위해 ORM 모델 직접 import 허용 (의도적 설계).

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
- Alembic 마이그레이션: `asyncio.run()` + `create_async_engine` (asyncpg 직접, psycopg2 불필요)
- FK에 `ON DELETE CASCADE` 있을 때는 relationship에 `passive_deletes=True` 추가 권장

### AI 서비스 트랜잭션 패턴
`ai/service.py`의 `parse_and_save` / `execute_delete`는 중첩 트랜잭션 방지를 위해
`_create` / `_update` / `_delete` 내부에서 `session.begin()`을 사용하지 않고,
최상위 함수에서 `await session.commit()` / `await session.rollback()`으로 관리한다.
다른 모듈 서비스를 호출하지 않고 직접 ORM 객체를 `session.add()`한다.

### AI 다중 액션 패턴 (`_process_multi_actions`)
AI 응답에 `actions` 배열이 있으면 순서대로 처리한다.
각 `_create` 후 `await session.flush()`를 호출해 순서 의존성을 해결한다.
(예: `travel_trip` 생성 직후 `travel_plan` 항목이 `trip_name`으로 같은 여행을 조회 가능)
삭제는 다중 액션 배열에서 처리하지 않고 개별 `/execute` 엔드포인트로만 처리한다.

### AI 컨텍스트 로딩 패턴
`parse_and_save`는 매 요청마다 두 가지 컨텍스트를 로딩한다:
- `_load_user_context`: 도메인별 최근 현황 (운동·수면·자산·독서·영어·CF·여행·플래너)
  - 이번 주 vs 지난 주 운동 비교, 자산 3개월 추이, 수면 전주 비교, Phase별 진행률 포함
  - 예정·진행 중 여행의 plan_items(Day별) + 체크리스트 진행률 포함
- `_load_categories_context`: 플래너 카테고리 목록 (Phase 날짜 범위 + 미완료 항목 3개)

날짜 변수 11개를 시스템 프롬프트에 주입: `today`, `yesterday`, `tomorrow`, `day_before_yesterday`, `week_start`, `last_week_start`, `next_week_start`, `month_start`, `last_month_start`, `week_start_plus1`, `week_start_plus2`

### 플래너 다중 선택 삭제 패턴
`handleBulkCategoryDelete`는 `Promise.allSettled`로 병렬 처리한다.
성공한 항목만 즉시 UI에서 제거하고, 실패한 항목은 선택 상태 유지 → 재시도 가능.

## 데이터 모델

### Planner
```
RoadmapSettings (단일 row) → start_date
Phase (4개) → order_index, months, color
  └── Category (Phase당 4개) → icon, title, subtitle
        └── RoadmapItem → text, offset(float), is_completed
```
- `Phase.start_date` = `RoadmapSettings.start_date + 이전 Phase months 합` (파생, DB 저장 X)
- `Item.deadline` = `Phase.start_date + offset개월` (파생, DB 저장 X)

### Travel
```
Trip → name, destination, start_date, end_date, status, note
  ├── TripChecklistItem → text, is_checked, order_index
  └── TripPlanItem     → day, sort_order, time, title, description
```
- FK에 `ON DELETE CASCADE` 적용 (migration)
- `TripResponse`는 항상 `checklist_items`와 `plan_items`를 `selectinload`로 eager load

## 테스트 패턴

```python
# conftest.py 구조
# - async_client: httpx.AsyncClient (실제 DB 대상)
# - 각 테스트 함수는 async def test_*
# - 인증 헤더: headers={"Authorization": f"Bearer {token}"}

# 새 모듈 테스트 작성 패턴 (test_travel.py 참고)
@pytest.mark.asyncio
async def test_create_xxx(async_client, auth_headers):
    res = await async_client.post("/api/v1/xxx", json={...}, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["field"] == expected

# 실행
uv run pytest                    # 전체
uv run pytest tests/test_xxx.py  # 특정 파일
uv run pytest -k "test_name"     # 특정 테스트
```

**중요**: mock DB 사용 금지 — 실제 DB(SQLite in-memory via test config)에서 실행.

## 자주 발생하는 실수 방지

| 상황 | 잘못된 방법 | 올바른 방법 |
|------|-----------|-----------|
| 관계 데이터 로딩 | `trip.plan_items` 직접 접근 | `selectinload(Trip.plan_items)` 쿼리에 포함 |
| AI 서비스 저장 | `await finance_svc.create(session, data)` | `session.add(AssetRecord(**data))` 직접 |
| 다중 액션 순서 보장 | `_create` 후 바로 다음 액션 | `_create` 후 `await session.flush()` |
| 날짜 필드 수정 | `setattr(record, "log_date", "2026-01-01")` | `_safe_date()` 변환 후 set |
| 트래블 체크리스트 생성 | `trip_id` 직접 사용 | `trip_name`으로 Trip 조회 후 `trip.id` 사용 |
| 카테고리 삭제 | DB CASCADE만 믿기 | `planner_category`는 `RoadmapItem` 먼저 명시 삭제 |

## 새 모듈 추가 패턴

### 백엔드
```
app/modules/<name>/
├── __init__.py
├── router.py    # APIRouter, prefix="/api/v1/<name>"
├── service.py   # 비즈니스 로직, AsyncSession을 인자로 받음
├── models.py    # SQLAlchemy 모델 (필요 시)
└── schemas.py   # Pydantic 요청/응답 스키마
```
`app/main.py`의 `create_app()`에서 `app.include_router()`로 등록.

### 프론트엔드
```
frontend/app/(dashboard)/<name>/
└── page.tsx     # 'use client' 컴포넌트, travelApi 패턴 참고
frontend/lib/api.ts   # <name>Api 객체 추가
frontend/types/index.ts # 응답 인터페이스 추가
```

### 체크리스트
- [ ] 백엔드: models → schemas → service → router → main.py 등록
- [ ] 테스트: `tests/test_<name>.py` 작성 (CRUD 최소)
- [ ] 프론트엔드: types → api.ts → page.tsx
- [ ] AI 지원 필요 시: `ai/service.py`의 `_create`, `_update`, `_delete`, `_find_record` 에 모듈 추가
- [ ] CSV 내보내기 필요 시: `export/service.py` + `export/router.py` 에 엔드포인트 추가

## 환경변수

`.env` 파일 (pydantic-settings가 자동 로드):

```
APP_NAME=Life Dashboard
DEBUG=false
DATABASE_URL=postgresql+asyncpg://postgres.[id]:[PW]@aws-0-[region].pooler.supabase.com:5432/postgres
JWT_SECRET=<안전한 랜덤 문자열>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<비밀번호>
GEMINI_API_KEY=<Google AI Studio 키>
CORS_ORIGINS=http://localhost:3000,https://<vercel-domain>.vercel.app
```

프론트엔드 `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **주의**: `DATABASE_URL`은 Supabase **Session Pooler** URL 사용 (Direct Connection은 IPv6 — Render 무료 티어 불가)

## 알려진 기술 부채

- `ai/service.py`가 타 모듈 ORM model 직접 import — AI 트랜잭션 패턴 때문에 불가피, 리팩토링 대비 이득 낮음
