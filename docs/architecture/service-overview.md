# Life Dashboard — 서비스 동작 구조

> 마지막 업데이트: 2026-06-26

---

## 1. 전체 구조

```
[사용자 브라우저]
      │
      ▼
[Vercel — Next.js (App Router)]
      │  JWT 인터셉터 (axios)
      ▼
[Render — FastAPI (uvicorn)]
      │  SQLAlchemy 2.0 async
      ▼
[Supabase — PostgreSQL]
      │
      └─ Gemini API (google-genai) ← AI 채팅/주간 리포트
```

**배포 위치**
| 레이어 | 서비스 | 비고 |
|--------|--------|------|
| 프론트엔드 | Vercel | Next.js App Router |
| 백엔드 | Render | FastAPI + uvicorn (free tier, 콜드 스타트 있음) |
| DB | Supabase | PostgreSQL, Session Pooler URL (IPv4) |
| AI | Google Gemini | gemini-3.1-flash-lite |
| Keep-alive | cron-job.org | 14분마다 GET /health ping |

---

## 2. 요청 흐름

### 일반 API 요청
```
브라우저
  → axios (JWT Bearer 헤더 자동 첨부)
  → FastAPI router
  → Depends(get_current_user) — JWT 검증
  → Depends(get_db) — AsyncSession 주입
  → service 함수 (비즈니스 로직)
  → SQLAlchemy ORM
  → PostgreSQL
  ← 응답 (Pydantic 스키마로 직렬화)
```

### AI 채팅 요청 (`/api/v1/ai/chat`)
```
브라우저 (메시지 + 히스토리 최대 20개)
  → FastAPI /ai/chat
  → parse_and_save()
      ├─ _load_user_context()    — 전 도메인 현황 DB 조회
      ├─ _load_categories_context() — 플래너 카테고리 조회
      ├─ 시스템 프롬프트 조립 (날짜 변수 11개 + 컨텍스트 주입)
      ├─ Gemini API 호출 (JSON 응답 강제)
      └─ 응답 파싱 → action 분기
            ├─ actions 배열 → _process_multi_actions() (create/update 순차)
            ├─ action=create  → _create() + commit()
            ├─ action=update  → _update() + commit()
            ├─ action=delete  → pending_filter 반환 (미실행)
            └─ action=null    → reply만 반환 (저장 없음)
  ← ChatResponse (reply, saved, module, action, pending_filter, suggestions)

삭제 확인 시:
  브라우저 확인 버튼 → POST /ai/execute → _delete() + commit()
```

### 홈 대시보드 (`/api/v1/dashboard/overview`)
```
브라우저
  → FastAPI /dashboard/overview
  → asyncio.gather(6개 스냅샷 동시 조회)
      ├─ _planner_snapshot()
      ├─ _finance_snapshot()
      ├─ _health_snapshot()
      ├─ _growth_snapshot()
      ├─ _career_snapshot()
      └─ _travel_snapshot()
  ← OverviewResponse (한 모듈 실패해도 나머지 반환)
```

---

## 3. 모듈 구조

```
app/
├── main.py               # create_app() — 라우터 등록, CORS
├── core/
│   ├── config.py         # pydantic-settings (.env 자동 로드)
│   ├── database.py       # async 엔진, get_db DI
│   ├── models.py         # Phase, Category, RoadmapItem, RoadmapSettings
│   └── security.py       # JWT 생성/검증, get_current_user
├── api/v1/
│   └── health.py         # GET /health (DB ping, cron 대상)
└── modules/
    ├── auth/             # POST /api/v1/auth/token
    ├── planner/          # 로드맵 CRUD
    ├── finance/          # 자산 기록 CRUD + 요약
    ├── health/           # 운동·수면 CRUD + 요약
    ├── growth/           # 독서·영어 CRUD + 요약
    ├── career/           # 설정·CF레이팅 CRUD + 요약
    ├── travel/           # 여행·체크리스트·일정 CRUD + 요약
    ├── ai/               # Gemini 채팅, 실행, 주간 리포트
    ├── dashboard/        # BFF 집계 (read-only, 자체 모델 없음)
    └── export/           # CSV 내보내기 (7개)
```

각 모듈 내부 구조:
```
<module>/
├── router.py    # APIRouter, 엔드포인트 정의
├── service.py   # 비즈니스 로직 (AsyncSession 인자로 받음)
├── models.py    # SQLAlchemy ORM 모델
└── schemas.py   # Pydantic 요청/응답 스키마
```

---

## 4. API 엔드포인트

### 인증 / 시스템
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/auth/token` | 로그인 → JWT 발급 |
| GET | `/health` | 서버+DB 상태 (cron ping) |
| GET | `/api/v1/dashboard/overview` | 전체 모듈 집계 (홈) |

### 플래너
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/planner/roadmap` | Phase+Category+Item 전체 |
| GET/PUT | `/api/v1/planner/settings` | 로드맵 시작일 설정 |
| POST | `/api/v1/planner/items` | 항목 생성 |
| PUT | `/api/v1/planner/items/{id}` | 항목 수정 |
| DELETE | `/api/v1/planner/items/{id}` | 항목 삭제 |
| PATCH | `/api/v1/planner/items/{id}/toggle` | 완료 토글 |
| PUT | `/api/v1/planner/phases/{id}` | Phase 수정 |
| POST | `/api/v1/planner/categories` | 카테고리 생성 |
| PUT | `/api/v1/planner/categories/{id}` | 카테고리 수정 |
| DELETE | `/api/v1/planner/categories/{id}` | 카테고리 삭제 |

### 재테크
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/finance/summary` | 자산 요약 (추이 포함) |
| GET | `/api/v1/finance/records` | 기록 목록 (limit/offset) |
| GET | `/api/v1/finance/records/{id}` | 단일 조회 |
| POST | `/api/v1/finance/records` | 생성 (날짜 중복 시 409) |
| PUT | `/api/v1/finance/records/{id}` | 수정 |
| DELETE | `/api/v1/finance/records/{id}` | 삭제 |

### 건강
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/health/summary` | 운동+수면 요약 |
| GET/POST | `/api/v1/health/exercise` | 운동 목록/생성 |
| PUT/DELETE | `/api/v1/health/exercise/{id}` | 수정/삭제 |
| GET/POST | `/api/v1/health/sleep` | 수면 목록/생성 (중복 409) |
| PUT/DELETE | `/api/v1/health/sleep/{id}` | 수정/삭제 |

### 자기계발
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/growth/summary` | 독서+영어 요약 |
| GET/POST | `/api/v1/growth/books` | 독서 목록/생성 |
| PUT/DELETE | `/api/v1/growth/books/{id}` | 수정/삭제 |
| GET/POST | `/api/v1/growth/english` | 영어 목록/생성 |
| PUT/DELETE | `/api/v1/growth/english/{id}` | 수정/삭제 |

### 커리어
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/career/summary` | CF레이팅 요약 |
| GET/PUT | `/api/v1/career/settings` | 커리어 설정 |
| GET/POST | `/api/v1/career/cf-ratings` | 레이팅 목록/생성 |
| DELETE | `/api/v1/career/cf-ratings/{id}` | 삭제 |

### 여행
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/travel/summary` | 여행 요약 |
| GET/POST | `/api/v1/travel/trips` | 여행 목록/생성 |
| GET/PUT/DELETE | `/api/v1/travel/trips/{id}` | 단일 조회/수정/삭제 |
| POST | `/api/v1/travel/trips/{id}/checklist` | 체크리스트 추가 |
| PATCH | `/api/v1/travel/checklist/{id}/toggle` | 체크 토글 |
| DELETE | `/api/v1/travel/checklist/{id}` | 체크리스트 삭제 |
| POST | `/api/v1/travel/trips/{id}/plan` | 일정 추가 |
| DELETE | `/api/v1/travel/plan/{id}` | 일정 삭제 |

### AI
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/ai/chat` | 채팅 + 자동 데이터 저장 |
| POST | `/api/v1/ai/execute` | 삭제 확인 후 실행 |
| GET | `/api/v1/ai/weekly-report` | AI 주간 리포트 |

### CSV 내보내기
| Method | Path |
|--------|------|
| GET | `/api/v1/export/finance` |
| GET | `/api/v1/export/health/exercise` |
| GET | `/api/v1/export/health/sleep` |
| GET | `/api/v1/export/growth/books` |
| GET | `/api/v1/export/growth/english` |
| GET | `/api/v1/export/career` |
| GET | `/api/v1/export/travel` |

---

## 5. AI 서비스 상세

### 지원 모듈 (생성)
| 모듈명 | 대상 |
|--------|------|
| `health_exercise` | 운동 기록 |
| `health_sleep` | 수면 기록 |
| `finance_record` | 자산 기록 |
| `growth_book` | 독서 기록 |
| `growth_english` | 영어 학습 기록 |
| `career_cf_rating` | CF 레이팅 |
| `travel_trip` | 여행 |
| `travel_checklist` | 체크리스트 항목 |
| `travel_plan` | 일정 항목 |
| `planner_item` | 플래너 항목 |

### 지원 모듈 (수정)
위 목록 전체 + `planner_category` (icon, title, subtitle)

### 지원 모듈 (삭제 — 확인 후 실행)
위 생성 목록 전체 + `planner_category` + `planner_items_by_phase`

### 컨텍스트 로딩 (매 요청)
- 이번 달·이번 주 운동 (지난 주 비교)
- 최근 14일 수면 (전주 비교)
- 최신 자산 3개월 추이
- 독서 현황 (읽는 중/예정/완독)
- 이번 달 영어 (activity_type별)
- 최근 CF 레이팅
- 예정·진행 중 여행 일정+체크리스트
- 플래너 진행률 (Phase별) + 마감 임박/지연 항목
- 플래너 카테고리 목록 (category_id 포함)

### 삭제 2-step 패턴
```
/chat → action="delete_pending", pending_filter 반환
사용자 확인 →
/execute → 실제 삭제 + commit
```

---

## 6. 데이터 모델

### 플래너
```
RoadmapSettings (단일 row)
  └─ start_date

Phase (4개)
  ├─ order_index, months, color, name, label
  └─ Category (Phase당 N개)
        ├─ icon, title, subtitle, order_index
        └─ RoadmapItem
              ├─ text, offset(float), is_completed
              └─ deadline = phase.start_date + offset개월 (파생값, DB 미저장)
```

### 재테크
```
AssetRecord: record_date(unique), total_assets, monthly_income, monthly_expense, note
```

### 건강
```
ExerciseLog: log_date, exercise_type, duration_minutes, note
SleepLog:    log_date(unique), sleep_hours, quality(1~5), note
```

### 자기계발
```
BookRecord:  title, author, status(planned/reading/completed), rating, start_date, end_date, note
EnglishLog:  log_date, activity_type(reading/listening/speaking/writing/vocab), duration_minutes, note
```

### 커리어
```
CareerSettings: cf_handle, target_rating, note (단일 row)
CFRatingLog:    log_date, rating, rank_name
```

### 여행
```
Trip: name, destination, start_date, end_date, status, note
  ├─ TripChecklistItem: text, is_checked, order_index  (ON DELETE CASCADE)
  └─ TripPlanItem:      day, sort_order, time, title, description  (ON DELETE CASCADE)
```

---

## 7. 핵심 패턴

### SQLAlchemy async 규칙
- Lazy loading 금지 → `selectinload` / `joinedload` 명시
- 세션은 `Depends(get_db)` 주입, service 자체 생성 금지
- 트랜잭션: service layer에서 `commit()` / `rollback()` 관리

### AI 서비스 트랜잭션 규칙
- `_create` / `_update` / `_delete` 내부에서 `session.begin()` 사용 금지
- 다른 모듈 service 호출 금지 → ORM 객체 직접 `session.add()`
- 다중 액션: 각 `_create` 후 `await session.flush()` (순서 의존성 해결)

### 모듈 간 통신 규칙
- 다른 모듈의 `service layer`만 호출
- 다른 모듈의 model/repository 직접 import 금지
- 예외: `ai/service.py`는 트랜잭션 중첩 방지를 위해 ORM 직접 import 허용

### 프론트엔드 패턴
- JWT: axios 인터셉터가 모든 요청에 자동 첨부
- AI 데이터 저장 이벤트: `ai-data-saved` 이벤트 → `useAiRefresh` 훅 → 페이지 데이터 리프레시
- 플래너 다중 삭제: `Promise.allSettled` 병렬 처리, 성공 항목만 즉시 UI 제거

---

## 8. 마이그레이션 이력

| 파일 | 내용 |
|------|------|
| `4bbb978ce5a7` | 플래너 테이블 생성 (phases, categories, roadmap_items, roadmap_settings) |
| `a1b2c3d4e5f6` | 플래너 초기 seed 데이터 |
| `b2c3d4e5f6a7` | 도메인 테이블 생성 (finance, health, growth, career) |
| `c3d4e5f6a7b8` | 여행 테이블 생성 (trips, checklist_items) — ON DELETE CASCADE |
| `4fbe97fa41c1` | 여행 일정 테이블 추가 (trip_plan_items) — ON DELETE CASCADE |
