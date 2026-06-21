# CLAUDE.md — Life Dashboard

## 프로젝트 개요

5년 라이프 로드맵을 7개 도메인(플래너·재테크·건강·자기계발·커리어·여행·AI)으로 관리하는
풀스택 개인 대시보드. FastAPI 백엔드 + Next.js 프론트엔드, 단일 사용자 기준, 학습 목적 겸 포트폴리오.

## 기술 스택

### 백엔드
- **Python 3.12+**, 패키지 관리: `uv` (`pyproject.toml` + `uv.lock`)
- **FastAPI** + **uvicorn** (ASGI)
- **SQLAlchemy 2.0 async** + **asyncpg** (PostgreSQL 드라이버)
- **Alembic** (마이그레이션)
- **pydantic-settings** (환경설정, `.env` 자동 로드)
- **pytest** + **httpx** (테스트, 60개)
- **PyJWT** (JWT 인증)
- **python-multipart** (OAuth2 폼 데이터)
- **google-genai** (Gemini AI — gemini-2.0-flash-lite 모델)

### 프론트엔드
- **Next.js** (App Router, `frontend/`)
- **TypeScript**
- **Tailwind CSS**
- **axios** (API 클라이언트, JWT 인터셉터 포함)
- **recharts** (차트)
- **lucide-react** (아이콘)


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
# 백엔드 서버 실행
uv run uvicorn app.main:app --reload

# 프론트엔드 개발 서버
cd frontend && npm run dev   # http://localhost:3000

# 테스트 (60개)
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
│   │   ├── models.py        # Phase, Category, RoadmapItem, RoadmapSettings
│   │   └── security.py      # JWT 생성·검증, get_current_user
│   ├── api/v1/
│   │   └── health.py        # GET /api/v1/health
│   └── modules/
│       ├── auth/            # POST /api/v1/auth/token (JWT, secrets.compare_digest)
│       ├── planner/         # GET /roadmap, GET|PUT /settings, PATCH /items/{id}/toggle
│       ├── finance/         # /api/v1/finance/records CRUD + /summary
│       ├── health/          # /api/v1/health/exercise & /sleep CRUD + /summary
│       ├── growth/          # /api/v1/growth/books & /english CRUD + /summary
│       ├── career/          # /api/v1/career/settings + /cf-ratings CRUD + /summary
│       ├── travel/          # /api/v1/travel/trips CRUD + checklist + plan(일정)
│       ├── ai/              # /api/v1/ai/chat (Gemini), /execute (삭제 확인)
│       └── dashboard/       # GET /api/v1/dashboard/overview (BFF 집계)
├── alembic/
│   ├── env.py
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
│   │       ├── planner/     # 로드맵, Phase, 항목 관리 (마감일 날짜 피커 포함)
│   │       ├── finance/
│   │       ├── health/
│   │       ├── growth/
│   │       ├── career/
│   │       └── travel/      # 여행 CRUD + 체크리스트 탭 + 일정(plan) 탭
│   ├── components/
│   │   ├── AiModal.tsx      # AI 채팅 FAB 모달 (localStorage 이력 저장)
│   │   ├── Sidebar.tsx
│   │   └── Toast.tsx
│   ├── hooks/
│   │   └── useAiRefresh.ts  # ai-data-saved 이벤트 구독 → 페이지 데이터 리프레시
│   ├── lib/
│   │   └── api.ts           # axios 클라이언트 (JWT 인터셉터) + 모듈별 API 함수
│   └── types/
│       └── index.ts         # 모든 TypeScript 인터페이스
└── docs/
    ├── adr/
    ├── architecture/
    └── requirements/
```

## 아키텍처 원칙 (ADR 요약)

### Modular Monolith (ADR-0001)
코드는 도메인(기능) 단위로 묶는다.

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
- FK에 `ON DELETE CASCADE` 있을 때는 relationship에 `passive_deletes=True` 추가 권장

### AI 서비스 트랜잭션 패턴
`ai/service.py`의 `parse_and_save` / `execute_delete`는 중첩 트랜잭션 방지를 위해
`_create` / `_update` / `_delete` 내부에서 `session.begin()`을 사용하지 않고,
최상위 함수에서 `await session.commit()` / `await session.rollback()`으로 관리한다.
다른 모듈 서비스를 호출하지 않고 직접 ORM 객체를 `session.add()`한다.

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

## 알려진 문제 / 수정 필요

- **[app/modules/ai/service.py:357]** `execute_delete`가 `_delete` 예외 시 `session.rollback()` 미호출 → PendingRollbackError 가능
- **[frontend/components/AiModal.tsx:68]** localStorage 직렬화 시 `pendingFilter: null`로 초기화 → 새로고침 후 `delete_pending` 메시지의 확인 버튼 소멸
- **[frontend/app/(dashboard)/planner/page.tsx:66]** `dateToOffset`이 Phase 시작일로부터 15일 이내 날짜를 offset=0으로 반올림 → 마감일이 Phase 시작일로 잘못 설정됨
- **[frontend/app/(dashboard)/travel/page.tsx:649]** `handleAddPlanItem`에서 `t.plan_items` null guard 없음 → 엣지 케이스에서 TypeError
- **[app/modules/travel/models.py:19]** `checklist_items` / `plan_items` relationship에 `passive_deletes=True` 미설정 (DB에는 ON DELETE CASCADE 있음)
- **[app/modules/ai/service.py:374]** `_update`/`_delete`에서 WHERE 없이 전체 테이블 fetch 후 Python 필터링 (성능 문제, 데이터 증가 시)

## 현재 구현 상태

| 항목 | 상태 |
|------|------|
| FastAPI 앱 골격 (팩토리 패턴) | 완료 |
| `GET /api/v1/health` | 완료 |
| DB 설정 (async 엔진·세션·DI) | 완료 |
| Alembic 마이그레이션 (5개 버전) | 완료 |
| Auth 모듈 (`POST /api/v1/auth/token`, JWT, `secrets.compare_digest`) | 완료 |
| Planner 모듈 (로드맵 CRUD + 마감일 날짜 피커) | 완료 |
| Finance 모듈 (자산 기록 CRUD + 요약) | 완료 |
| Health 모듈 (운동/수면 CRUD + 요약) | 완료 |
| Growth 모듈 (독서/영어 CRUD + 요약) | 완료 |
| Career 모듈 (CF 레이팅 CRUD + 요약) | 완료 |
| Travel 모듈 (여행 CRUD + 체크리스트 + 일정 탭) | 완료 |
| AI 모듈 (Gemini 자연어 기록/수정/삭제, gemini-2.0-flash-lite) | 완료 |
| Dashboard 모듈 (`GET /api/v1/dashboard/overview` BFF 집계) | 완료 |
| Next.js 프론트엔드 (7개 페이지 + AI FAB 모달 + Toast) | 완료 |
| 테스트 (60개) | 완료 |

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

## 환경변수

`.env` 파일 (pydantic-settings가 자동 로드):

```
APP_NAME=Life Dashboard
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@host/lifedash
JWT_SECRET=<안전한 랜덤 문자열>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<비밀번호>
GEMINI_API_KEY=<Google AI Studio 키>
```

프론트엔드 `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
