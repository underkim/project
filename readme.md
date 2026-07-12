# Life Dashboard

> 5년 라이프 로드맵을 7개 도메인으로 관리하는 풀스택 개인 대시보드

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-79%20passed-brightgreen?style=flat)](./tests)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)](./LICENSE)

**[라이브 데모](https://project-theta-ten-70.vercel.app)** · **[API 문서](https://life-dashboard-api-vt5n.onrender.com/docs)**

> 🔔 Render 무료 티어 사용 중 — 첫 요청 시 수십 초 대기할 수 있습니다.

---

## 프로젝트 소개

플래너·재테크·건강·사용자 정의 기록·여행·AI를 하나의 대시보드에서 통합 관리합니다.
자연어 AI 어시스턴트로 데이터를 기록·수정·삭제하고, 주간 리포트를 자동 생성합니다.

학습 목적 겸 포트폴리오로 제작했으며, 실제 운영 중인 개인 도구입니다.

---

## 주요 기능

### 7개 도메인 관리
| 모듈 | 기능 |
|------|------|
| **플래너** | 5년 로드맵 Phase·Category·Item CRUD, 마감일 날짜 피커 |
| **재테크** | 자산 기록 CRUD + 저축률 요약 + CSV 내보내기 |
| **건강** | 운동·수면 기록 CRUD + 주간 요약 + CSV 내보내기 |
| **나의 기록** | 사용자가 직접 만드는 숫자·텍스트·완료 여부 추적 항목과 날짜별 기록 |
| **여행** | 여행 CRUD + 체크리스트 탭 + 일정(Plan) 탭 |
| **AI** | Gemini 자연어 기록·수정·삭제, 주간 리포트 자동 생성 |

### 기술적 특징
- **AI 자연어 인터페이스** — "오늘 러닝 45분 했어" 한 문장으로 DB 저장
- **BFF 집계 엔드포인트** — 홈 대시보드는 단일 API 호출로 7개 모듈 데이터 병렬 집계 (`asyncio.gather`)
- **SQLAlchemy 2.0 async** — 완전 비동기 ORM, Lazy loading 금지, `selectinload` 명시
- **JWT 인증** — `secrets.compare_digest` 타이밍 공격 방지
- **CSV 내보내기** — 5개 도메인 데이터 원클릭 다운로드

---

## 기술 스택

### 백엔드
- **Python 3.12** + **FastAPI** + **uvicorn**
- **SQLAlchemy 2.0 async** + **asyncpg** (PostgreSQL)
- **Alembic** (비동기 마이그레이션)
- **PyJWT** (인증)
- **Google Gemini** (`gemini-2.0-flash-lite`)
- **pytest** + **httpx** (테스트 79개)

### 프론트엔드
- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **Recharts** + **lucide-react**
- **Playwright** (E2E 테스트 13개)

### 인프라
- **Render** (백엔드 컨테이너) + **Supabase** (PostgreSQL) + **Vercel** (프론트엔드)
- **Docker** + **GitHub Actions** CI
- **uv** (Python 패키지 매니저)

---

## 아키텍처

```
┌─────────────────┐     HTTPS      ┌──────────────────────┐
│  Vercel         │ ─────────────► │  Render (FastAPI)    │
│  Next.js 15     │                │                      │
│  App Router     │                │  /api/v1/            │
└─────────────────┘                │  ├── auth/           │
                                   │  ├── planner/        │
                                   │  ├── finance/        │
                                   │  ├── health/         │
                                   │  ├── growth/         │
                                   │  ├── career/         │
                                   │  ├── travel/         │
                                   │  ├── ai/             │
                                   │  ├── dashboard/      │
                                   │  └── export/         │
                                   └──────────┬───────────┘
                                              │ asyncpg
                                              ▼
                                   ┌──────────────────────┐
                                   │  Supabase            │
                                   │  PostgreSQL 16       │
                                   └──────────────────────┘
```

### 설계 원칙
- **Modular Monolith** — 도메인 단위 패키지, 모듈 간 통신은 service layer만 통과
- **BFF 하이브리드** — 홈 화면은 단일 집계 엔드포인트, 상세 화면은 각 모듈 API 직접 호출
- **AI 트랜잭션** — 최상위에서 commit/rollback 단일 관리, 중첩 트랜잭션 방지

상세 ADR: [docs/adr/](./docs/adr/)

---

## 로컬 실행

### 요구사항
- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 20+

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 편집: JWT_SECRET, ADMIN_PASSWORD, GEMINI_API_KEY 입력
```

### 2. 백엔드

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# → http://localhost:8000/docs
```

### 3. 프론트엔드

```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm install && npm run dev
# → http://localhost:3000
```

### Docker Compose (전체 스택)

```bash
cp .env.example .env
docker compose up --build
```

---

## 테스트

```bash
# 백엔드 유닛·통합 테스트 (79개)
uv run pytest

# E2E 테스트 (Playwright, 13개)
cd frontend
E2E_USERNAME=admin E2E_PASSWORD=<비밀번호> npx playwright test
```

---

## 프로젝트 구조

```
project/
├── app/
│   ├── main.py              # FastAPI 앱 팩토리
│   ├── core/                # DB·설정·보안·모델
│   ├── api/v1/health.py     # 헬스체크
│   └── modules/             # 9개 도메인 모듈
│       ├── auth/
│       ├── planner/
│       ├── finance/
│       ├── health/
│       ├── growth/
│       ├── career/
│       ├── travel/
│       ├── ai/
│       ├── dashboard/
│       └── export/
├── alembic/                 # DB 마이그레이션 (5개 버전)
├── tests/                   # pytest 테스트 (79개)
├── frontend/                # Next.js 앱
│   ├── app/(dashboard)/     # 7개 페이지
│   ├── components/          # AiModal, Sidebar, Toast
│   ├── lib/api.ts           # axios 클라이언트
│   ├── types/               # TypeScript 인터페이스
│   └── e2e/                 # Playwright 테스트 (13개)
└── docs/                    # ADR + 아키텍처 문서
```

---

## 라이선스

MIT
