---
name: new-module
description: Scaffold a new domain module in this Life Dashboard project (backend FastAPI module + frontend page), following the project's established pattern. Use when the user asks to add a new module/domain/section to the dashboard (e.g. "새 모듈 추가해줘", "새로운 도메인 만들어줘", "습관 트래커 모듈 추가해줘").
---

# 새 모듈 추가 (Life Dashboard)

이 프로젝트(`CLAUDE.md` 참고)의 기존 7개 모듈(planner/finance/health/growth/career/travel/ai)과
동일한 구조로 새 모듈을 추가한다. 순서를 건너뛰지 말 것 — 각 단계가 다음 단계의 전제.

## 0. 먼저 결정할 것

- 단일 설정 row가 필요한가 (예: `career_settings`), 여러 record의 list인가 (예: `asset_records`), 둘 다인가 (career는 둘 다 가짐)?
  - 단일 row 패턴 참고: `app/modules/career/models.py`의 `CareerSettings` + `service.py`의 `get_settings`/`update_settings` (id=1 고정, 없으면 생성)
  - list 패턴 참고: `app/modules/finance/models.py`의 `AssetRecord` + `service.py`의 CRUD
- AI 채팅으로 생성/수정/삭제가 필요한가? (필요하면 6단계)
- CSV 내보내기가 필요한가? (필요하면 7단계)

## 1. 백엔드 스캐폴딩

```
app/modules/<name>/
├── __init__.py
├── models.py    # SQLAlchemy 모델 (Base 상속, app/core/database.py의 Base 사용)
├── schemas.py   # Pydantic Create/Update/Response + Summary 스키마
├── service.py   # AsyncSession을 인자로 받는 함수들 (자체 세션 생성 금지)
└── router.py    # APIRouter(prefix="/api/v1/<name>")
```

**필수 규칙 (CLAUDE.md):**
- Lazy loading 절대 금지 — 관계 로딩은 `selectinload`/`joinedload` 명시
- 세션은 `Depends(get_db)`로 주입, service가 자체 세션 생성 금지
- 트랜잭션은 `async with session.begin():` (career/finance service.py 참고) 또는 명시적 commit/rollback
- 다른 모듈의 model/repository를 직접 import 금지 — service layer만 호출 (ai/service.py만 예외)

`app/main.py`의 `create_app()`에 `app.include_router(<name>.router.router)` 등록.

## 2. Alembic 마이그레이션

```bash
uv run alembic revision --autogenerate -m "create <name> tables"
```

생성된 마이그레이션 파일을 반드시 확인:
- FK에 `ON DELETE CASCADE`가 필요하면 `ondelete='CASCADE'` 명시 (`c3d4e5f6a7b8_create_travel_tables.py` 참고) + 모델의 relationship에 `passive_deletes=True` 추가
- **Postgres 전용 DDL을 쓰는 경우** (예: RLS) 반드시 dialect 가드 추가 — 로컬/테스트 기본 DB가 SQLite이므로:
  ```python
  if op.get_bind().dialect.name != 'postgresql':
      return
  ```
  (`a632e06d74ce_enable_rls_all_tables.py` 참고)
- Supabase Security Advisor의 `rls_disabled_in_public` 경고를 피하려면 새 테이블에도 RLS 활성화 추가:
  ```python
  if op.get_bind().dialect.name == 'postgresql':
      op.execute('ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;')
  ```

로컬에서 검증 (SQLite에 no-op으로 적용되는지, downgrade도 되는지):
```bash
uv run alembic upgrade head
uv run alembic downgrade -1  # 원복도 확인
uv run alembic upgrade head
```

## 3. 백엔드 테스트

`tests/test_<name>.py` 작성 (`tests/test_career.py` 또는 `tests/test_finance.py` 패턴 참고):
- CRUD 최소 커버리지 (생성/조회/수정/삭제, 404, 검증 실패 422)
- `auth_client` fixture 사용 (JWT 인증 헤더 자동 첨부)
- mock DB 금지 — conftest.py의 SQLite in-memory 실제 DB 사용
- 새 모델은 `tests/conftest.py`의 model import 목록에 추가 필요 (`Base.metadata.create_all`이 인식하도록)

```bash
uv run pytest tests/test_<name>.py -q
uv run pytest -q   # 전체 회귀 확인
```

## 4. 프론트엔드

```
frontend/app/(dashboard)/<name>/page.tsx   # 'use client', travel/finance 페이지 패턴 참고
```
- `frontend/types/index.ts`에 Response 인터페이스 추가
- `frontend/lib/api.ts`에 `<name>Api` 객체 추가 (`financeApi` 패턴 참고 — axios client 재사용)
- `frontend/components/Sidebar.tsx`에 메뉴 추가

```bash
cd frontend && npx tsc --noEmit   # (이제 permission allowlist에 등록되어 있음)
```

## 5. 대시보드 연동 (선택)

홈 화면 요약 카드가 필요하면 `app/modules/dashboard/`에 스냅샷 추가:
- `schemas.py`에 `<Name>Snapshot` 추가
- `service.py`에 `_<name>_snapshot()` 추가 (dashboard/service.py의 `get_overview`가 **순차적으로** 호출 — 동시성 버그(하네스 엔지니어링 문서 참고) 재발 방지를 위해 asyncio.gather로 되돌리지 말 것)
- `OverviewResponse`에 필드 추가
- `frontend/types/index.ts`의 `OverviewResponse`/`<Name>Snapshot`에도 반영

## 6. AI 지원 (선택)

`app/modules/ai/service.py`에서:
- `_create`/`_update`/`_delete` 내부에 모듈 분기 추가 — **다른 모듈 service 호출 금지, ORM 객체 직접 `session.add()`** (중첩 트랜잭션 방지, CLAUDE.md 규칙)
- `_find_record`에 조회 로직 추가 (update/delete 전 대상 탐색용)
- 다중 액션(`_process_multi_actions`)에서 참조될 수 있으면 `_create` 후 `await session.flush()` 호출 확인
- `_load_user_context`에 요약 정보 라인 추가하면 채팅이 실제 데이터 기반으로 답변 가능 (finance goal 추가 사례 참고)
- 시스템 프롬프트의 `create 모듈·필드`/`update 필드`/`delete 필터` 섹션에 새 모듈 스펙 추가

## 7. CSV 내보내기 (선택)

`app/modules/export/service.py` + `router.py`에 `/api/v1/export/<name>` 엔드포인트 추가.

## 8. 최종 체크리스트

- [ ] `uv run pytest -q` 전체 통과
- [ ] `cd frontend && npx tsc --noEmit` 통과
- [ ] `git commit` 시 `.claude/hooks/pre-commit-check.sh`가 위 두 검사를 자동 재실행 (실패 시 커밋 차단됨 — 우회하지 말고 원인 수정)
