# 시스템 아키텍처

## 전체 구조

```
┌──────────────────────────────────────────────────────────────┐
│                        브라우저                               │
│         Next.js (App Router, TypeScript, Tailwind)           │
│         http://localhost:3000                                 │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP (axios + JWT Bearer)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   FastAPI (ASGI / uvicorn)                   │
│                   http://localhost:8000                       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  auth    │ │ planner  │ │ finance  │ │    health    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  growth  │ │  career  │ │  travel  │ │      ai      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           dashboard (BFF, read-only)                │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌──────────┐                                               │
│  │  export  │  CSV 내보내기 (finance/health/growth/career)  │
│  └──────────┘                                               │
└────────────────────────────┬─────────────────────────────────┘
                             │ asyncpg (SQLAlchemy 2.0 async)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│           PostgreSQL (prod) / SQLite (dev/test)              │
└──────────────────────────────────────────────────────────────┘
                             ▲
                             │ Gemini API (google-genai)
┌──────────────────────────────────────────────────────────────┐
│           Google Gemini (gemini-2.0-flash-lite)              │
└──────────────────────────────────────────────────────────────┘
```

## 레이어 구조 (모듈 내부)

```
router.py    ← HTTP 요청/응답, 인증(Depends), 파라미터 검증
    ↓
service.py   ← 비즈니스 로직, 트랜잭션 관리 (async with session.begin())
    ↓
models.py    ← SQLAlchemy ORM 모델
schemas.py   ← Pydantic 요청/응답 스키마
```

**모듈 간 통신 규칙**: 다른 모듈의 `service.py`만 호출. model·repository 직접 import 금지.

## 요청 흐름

### 일반 API 요청

```
클라이언트
  → POST /api/v1/auth/token → JWT 발급
  → GET /api/v1/finance/records (Bearer 헤더)
      → security.get_current_user() 검증
      → finance.service.list_records(session)
      → SELECT ... FROM asset_records
      → JSON 응답
```

### 대시보드 홈 집계

```
클라이언트
  → GET /api/v1/dashboard/overview
      → asyncio.gather(
            planner_svc.get_summary(),
            finance_svc.get_summary(),
            health_svc.get_summary(),
            growth_svc.get_summary(),
            career_svc.get_summary(),
            return_exceptions=True     ← 부분 실패 허용
        )
      → OverviewResponse 조합 → JSON 응답
```

### AI 자연어 입력

```
클라이언트 "오늘 운동 30분"
  → POST /api/v1/ai/chat
      → asyncio.to_thread(Gemini.generate_content, prompt)
      → AI 응답 파싱 → domain/action/fields 추출
      → session.add(ExerciseLog(...))
      → await session.commit()
      → 응답 (생성된 레코드 + 확인 메시지)
```

## 인증

- **단일 어드민 계정** — `ADMIN_USERNAME` / `ADMIN_PASSWORD` 환경변수
- **JWT** — PyJWT, `JWT_SECRET`, 만료 7일
- **비교** — `secrets.compare_digest` (타이밍 어택 방지)
- 모든 API 엔드포인트는 `Depends(get_current_user)` 적용 (헬스체크 제외)

## 인프라

| 환경 | API 서버 | 프론트엔드 | DB |
|------|----------|-----------|-----|
| 로컬 개발 | uvicorn --reload | next dev | SQLite |
| Docker Compose | uvicorn (컨테이너) | Next.js standalone | PostgreSQL 16 |

### Docker 구성

```yaml
services:
  db:   postgres:16-alpine + healthcheck
  api:  Python 3.12 + uv + Alembic auto-migrate
  web:  Node 20 multi-stage (builder → standalone runner)
```

### CI (GitHub Actions)

- **test**: uv sync → pytest (79개)
- **typecheck**: npm ci → tsc --noEmit
- 트리거: `push` / `PR` → `main`

## 관련 문서

- [adr/0001-modular-monolith.md](../adr/0001-modular-monolith.md)
- [adr/0002-bff-pattern.md](../adr/0002-bff-pattern.md)
- [adr/0003-sqlalchemy-async.md](../adr/0003-sqlalchemy-async.md)
- [architecture/data-model.md](./data-model.md)
