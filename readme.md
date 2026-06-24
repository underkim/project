# Life Dashboard

5년 라이프 로드맵을 7개 도메인(플래너·재테크·건강·자기계발·커리어·여행·AI)으로 관리하는 풀스택 개인 대시보드.

## 기술 스택

| 영역 | 스택 |
|------|------|
| 백엔드 | FastAPI, SQLAlchemy 2.0 (async), asyncpg, Alembic, PyJWT |
| 프론트엔드 | Next.js (App Router), TypeScript, Tailwind CSS, Recharts |
| DB | PostgreSQL (prod) / SQLite (dev) |
| AI | Google Gemini (`gemini-2.0-flash-lite`) |
| 인프라 | Docker Compose, GitHub Actions CI |
| 테스트 | pytest (79개), TypeScript type-check |

## 구현 상태

| 모듈 | 기능 |
|------|------|
| auth | JWT 로그인 |
| planner | 5년 로드맵 Phase·Category·Item CRUD, 마감일 날짜 피커 |
| finance | 자산 기록 CRUD + 요약 + CSV 내보내기 |
| health | 운동·수면 기록 CRUD + 요약 + CSV 내보내기 |
| growth | 독서·영어 기록 CRUD + 요약 + CSV 내보내기 |
| career | CF 레이팅 CRUD + 요약 + CSV 내보내기 |
| travel | 여행 CRUD + 체크리스트 + 일정 탭 |
| ai | Gemini 자연어 기록·수정·삭제 + 주간 리포트 |
| dashboard | BFF 집계 (`GET /api/v1/dashboard/overview`) |

## 로컬 실행

### 요구사항

- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL 또는 SQLite (개발용 기본값)

### 환경 변수 설정

```bash
cp .env.example .env
# .env를 열어 JWT_SECRET, ADMIN_PASSWORD, GEMINI_API_KEY 등 입력
```

### 백엔드

```bash
# 의존성 설치
uv sync

# DB 마이그레이션
uv run alembic upgrade head

# 서버 시작 (http://localhost:8000)
uv run uvicorn app.main:app --reload
```

### 프론트엔드

```bash
cd frontend

# 환경 변수
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 의존성 설치 & 개발 서버 시작 (http://localhost:3000)
npm install
npm run dev
```

### 테스트

```bash
uv run pytest
```

## Docker Compose 실행

```bash
cp .env.example .env
# .env에서 POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD, GEMINI_API_KEY 설정

docker compose up --build
```

- API: http://localhost:8000
- 프론트엔드: http://localhost:3000
- DB 데이터는 `postgres_data` 볼륨에 영속 저장

## 아키텍처

- **Modular Monolith** — 도메인 단위 패키지, 모듈 간 통신은 service layer만 통과
- **BFF 하이브리드** — 홈 화면은 단일 집계 엔드포인트, 상세 화면은 각 모듈 API 직접 호출
- **SQLAlchemy 2.0 async** — Lazy loading 금지, `selectinload`/`joinedload` 명시
- **AI 트랜잭션** — 최상위에서 commit/rollback 관리, 중첩 트랜잭션 방지

상세 ADR: [docs/adr/](./docs/adr)

## API 문서

서버 실행 후:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 라이선스

MIT
