# TASK-001: Dashboard Partial Failure Visibility

status: done
type: feature
priority: medium
created_by: codex
implemented_by: claude
reviewed_by:

created_at: 2026-06-28
approved_at: 2026-06-28
implemented_at: 2026-06-28
reviewed_at:
merged_at: 2026-06-28

branch: feature/TASK-001-dashboard-partial-failure-visibility
pr: merged directly into main
merge_commit: f056f22

---

## 1. 목표

* 현재 dashboard BFF는 일부 모듈 실패 시 해당 snapshot을 `null`로 반환해 홈 화면 전체 장애를 막는다.
* 하지만 어떤 모듈이 실패했는지 API 응답과 프론트 화면에서 알 수 없어 운영/디버깅/사용자 안내가 어렵다.
* 기존 `GET /api/v1/dashboard/overview` 응답 구조와 하위 호환성을 유지하면서, 부분 실패 메타데이터를 추가하고 홈 화면에 조용한 안내를 표시한다.

## 2. 요구사항

### 포함 범위

* `GET /api/v1/dashboard/overview` 응답에 부분 실패 메타데이터를 추가한다.
* 기존 `planner`, `finance`, `health`, `growth`, `career`, `travel` snapshot 필드는 유지한다.
* 실패한 모듈은 기존처럼 해당 필드를 `null`로 둔다.
* 추가 메타데이터에는 최소한 다음 정보를 포함한다.
  * `partial_failure: boolean`
  * `failed_modules: string[]`
* dashboard service에서 broad exception을 완전히 숨기지 말고, 내부 로깅 또는 명시적 실패 수집으로 추적 가능하게 만든다.
* 프론트 홈 화면에서 `partial_failure`가 true인 경우 작고 방해되지 않는 안내 메시지를 표시한다.
* 백엔드 테스트와 프론트 타입 검증 계획을 포함한다.

### 제외 범위

* dashboard를 write 기능이 있는 모듈로 변경하지 않는다.
* 각 도메인 summary API의 응답 구조는 변경하지 않는다.
* DB schema, migration, seed data는 변경하지 않는다.
* AI 서비스 트랜잭션 구조는 변경하지 않는다.
* 전체 프론트 UI 개편이나 카드 레이아웃 재설계는 하지 않는다.
* 외부 모니터링/Sentry 같은 신규 인프라 연동은 하지 않는다.

### 결정 필요 사항

* 프론트 안내 문구를 사용자에게 노출할지, 개발자용 작은 경고로만 둘지 결정 필요.
* `failed_modules` 값을 영문 모듈 키(`finance`)로 둘지, 화면 표시용 한글 라벨까지 응답에 포함할지 결정 필요. 기본 제안은 API는 영문 키만 반환하고 프론트에서 라벨 매핑.

## 3. 현재 구조 분석

* 관련 모듈:
  * `app/modules/dashboard`: 홈 화면 BFF 집계 모듈
  * `app/modules/planner`, `finance`, `health`, `growth`, `career`, `travel`: dashboard가 호출하는 도메인 service
  * `frontend/app/(dashboard)/page.tsx`: 홈 화면
* 관련 파일:
  * `app/modules/dashboard/service.py`
  * `app/modules/dashboard/schemas.py`
  * `app/modules/dashboard/router.py`
  * `tests/test_dashboard.py`
  * `frontend/types/index.ts`
  * `frontend/lib/api.ts`
  * `frontend/app/(dashboard)/page.tsx`
* 기존 패턴:
  * dashboard는 ADR-0002에 따라 read-only BFF로 동작한다.
  * `service.get_overview()`는 각 snapshot 함수를 `asyncio.gather(..., return_exceptions=True)`로 실행한다.
  * 각 `_xxx_snapshot()` 함수는 현재 내부에서 `try/except Exception` 후 `None`을 반환한다.
  * 프론트는 `dashboardApi.getOverview()`로 단일 overview 응답을 받아 홈 카드에 분배한다.
  * `OverviewResponse` TypeScript 타입은 backend schema와 같은 snapshot nullable 구조를 가진다.
* 참고 문서:
  * `CLAUDE.md`
  * `README.md`
  * `docs/adr/0001-modular-monolith.md`
  * `docs/adr/0002-bff-pattern.md`
  * `docs/adr/0003-sqlalchemy-async.md`
  * `AGENTS.md`
  * `docs/agent-skills/claude-task-executor.md`

## 4. 영향 범위

### Backend

* `app/modules/dashboard/schemas.py`
  * `OverviewMeta` 같은 새 Pydantic schema 추가.
  * `OverviewResponse`에 `meta` 필드 추가.
* `app/modules/dashboard/service.py`
  * snapshot별 실패를 모듈명과 함께 수집하는 helper 도입.
  * 실패한 모듈 목록을 `OverviewResponse.meta.failed_modules`에 담는다.
  * 실패는 로깅하되 사용자 응답에는 민감한 exception detail을 노출하지 않는다.
* `app/modules/dashboard/router.py`
  * response model은 `OverviewResponse` 유지. 필요 시 import만 유지.

### Database / Migration

* 새 테이블: 없음
* 새 컬럼: 없음
* migration 필요 없음

### Frontend

* `frontend/types/index.ts`
  * `OverviewMeta` 인터페이스 추가.
  * `OverviewResponse`에 `meta: OverviewMeta` 또는 `meta?: OverviewMeta` 추가.
* `frontend/app/(dashboard)/page.tsx`
  * `data?.meta?.partial_failure`가 true이면 상단에 작은 안내 배너 표시.
  * 기존 카드 렌더링과 데이터 fallback은 유지.
* `frontend/lib/api.ts`
  * API path 변경 없음. 타입 import만 기존 `OverviewResponse` 유지.

### Test

* `tests/test_dashboard.py`
  * 빈 DB overview 응답에 `meta`가 포함되는지 확인.
  * 특정 모듈 service를 monkeypatch로 실패시켜도 200을 반환하고 해당 snapshot은 `null`, `meta.partial_failure`는 true, `failed_modules`에 모듈명이 포함되는지 확인.
  * 기존 snapshot 반영 테스트는 유지.
* 프론트 타입 검증
  * `frontend/types/index.ts` 변경 후 TypeScript 검증 필요.

### Docs

* 이 task 문서 외 추가 문서 변경은 필수 아님.
* 구현 중 API 응답 예시를 문서화할 필요가 생기면 `docs/architecture` 또는 `docs/requirements` 변경 여부를 별도 판단한다.

## 5. 설계 결정

* 기존 dashboard BFF의 핵심 설계인 “부분 실패 허용”은 유지한다.
* 기존 snapshot 필드를 변경하지 않고 `meta` 필드를 추가해 하위 호환성을 최대한 유지한다.
* 각 snapshot 함수가 실패를 조용히 `None`으로 바꾸는 구조는 추적성이 낮으므로, 실패 수집 책임을 공통 wrapper로 옮긴다.
* API 응답에는 exception message를 담지 않는다. 운영/보안 관점에서 내부 오류 상세를 사용자에게 노출하지 않는 것이 안전하다.
* 대안 1: HTTP 207 Multi-Status 사용
  * 장점: 부분 성공 의미가 명확하다.
  * 단점: 기존 클라이언트 처리와 테스트가 복잡해지고 일반 REST 클라이언트 기대와 어긋날 수 있다.
* 대안 2: 기존처럼 `null`만 반환
  * 장점: 변경 없음.
  * 단점: 사용자가 일부 데이터 누락 원인을 알 수 없고 운영 추적성이 낮다.
* 선택: HTTP 200 + 기존 nullable snapshot + `meta.partial_failure/failed_modules` 추가.

## 6. API 설계

| Method | Path | 설명 | 요청 | 응답 |
| ------ | ---- | -- | -- | -- |
| GET | `/api/v1/dashboard/overview` | 홈 대시보드 overview 집계. 일부 모듈 실패 시 가능한 snapshot은 반환하고 실패 메타데이터를 함께 반환 | 없음 | 기존 snapshot 필드 + `meta` |

응답 예시:

```json
{
  "planner": { "total_items": 10, "completed_items": 3 },
  "finance": null,
  "health": { "exercise_days_this_week": 2 },
  "growth": null,
  "career": { "cf_handle": "test" },
  "travel": { "total": 1 },
  "meta": {
    "partial_failure": true,
    "failed_modules": ["finance", "growth"]
  }
}
```

## 7. DB 설계

* 새 테이블: 없음
* 새 컬럼: 없음
* 관계: 변경 없음
* 인덱스: 변경 없음
* 삭제 정책: 변경 없음
* migration 필요 여부: 필요 없음

## 8. 프론트엔드 설계

* 화면 위치:
  * `frontend/app/(dashboard)/page.tsx` 홈 화면 상단 영역
* 컴포넌트 변경:
  * 별도 파일 생성 없이 page 내부에 작은 warning/banner 렌더링을 추가한다.
  * 아이콘은 이미 import된 `AlertTriangle` 사용 가능.
* API 연동:
  * `dashboardApi.getOverview()` path는 유지한다.
  * `OverviewResponse` 타입에 `meta`를 추가한다.
* 상태 관리:
  * 별도 상태 추가 없이 `data?.meta`를 직접 참조한다.
* 사용자 흐름:
  * 전체 API 실패 시 기존 `error` 표시 유지.
  * 일부 모듈 실패 시 홈 화면은 계속 표시하고, 상단에 “일부 데이터를 불러오지 못했습니다” 수준의 안내만 표시한다.
  * 실패한 모듈명은 결정 필요 사항에 따라 한글 라벨로 보여주거나 개발자용으로 숨긴다.

## 9. 테스트 계획

### Backend

* `uv run pytest tests/test_dashboard.py`
* 추가/수정할 테스트:
  * `test_overview_empty_db`에서 `meta.partial_failure == false`, `meta.failed_modules == []` 확인.
  * monkeypatch로 `finance_svc.get_summary` 또는 dashboard snapshot 함수를 실패시키는 테스트 추가.
  * 실패 시 status 200, 실패 모듈 snapshot `null`, `meta.partial_failure == true`, `failed_modules` 포함 확인.
* 전체 회귀 확인이 필요하면 `uv run pytest` 실행.

### Frontend Type Check

* `cd frontend && npm run type-check`가 있으면 실행.
* type-check script가 없다면 `cd frontend && npx tsc --noEmit` 실행.
* 기존 lint/check 스크립트가 있다면 `package.json` 확인 후 프로젝트 표준 명령 사용.

### E2E 필요 여부

* 필수는 아님.
* 이유: API 응답 메타데이터와 조건부 안내 배너 추가가 핵심이며 주요 사용자 입력 흐름을 바꾸지 않는다.
* 단, 홈 화면 partial failure 배너를 실제 브라우저에서 확인하고 싶다면 Playwright smoke 테스트를 별도 후속 task로 분리한다.

## 10. Claude Code 작업 지시서

Claude Code는 이 task가 `status: approved`로 변경된 뒤에만 구현한다.

수정 예상 파일:

* `app/modules/dashboard/schemas.py`
* `app/modules/dashboard/service.py`
* `tests/test_dashboard.py`
* `frontend/types/index.ts`
* `frontend/app/(dashboard)/page.tsx`

구현 순서:

1. `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`를 먼저 확인한다.
2. `app/modules/dashboard/schemas.py`에 `OverviewMeta` schema를 추가하고 `OverviewResponse`에 `meta` 필드를 추가한다.
3. `app/modules/dashboard/service.py`에서 snapshot 실패를 모듈명과 함께 수집하는 공통 helper를 도입한다.
4. 기존 snapshot 필드 이름과 nullable 동작은 유지한다.
5. 실패한 모듈은 `failed_modules`에 추가하고, `partial_failure`는 `len(failed_modules) > 0`으로 계산한다.
6. 내부 exception detail은 API 응답에 넣지 않는다. 필요 시 Python logger로만 기록한다.
7. `tests/test_dashboard.py`에 meta 기본 구조 테스트와 partial failure 테스트를 추가한다.
8. `frontend/types/index.ts`에 `OverviewMeta` 타입을 추가하고 `OverviewResponse`를 갱신한다.
9. `frontend/app/(dashboard)/page.tsx`에서 `data?.meta?.partial_failure` 조건 안내를 추가한다.
10. 아래 검증 명령을 실행하고 결과를 task 문서에 기록한다.
11. 구현 완료 후 task 상태를 `implemented`로 바꾸고 `branch`, `pr`, `implemented_at`을 채운다.

주의할 규칙:

* dashboard는 read-only BFF 모듈로 유지한다.
* dashboard에서 다른 모듈 model/repository를 직접 import하지 않는다.
* 기존 snapshot 응답 필드를 삭제하거나 이름을 바꾸지 않는다.
* DB migration을 만들지 않는다.
* `.env`를 읽지 않는다.
* 기능 범위를 벗어난 UI 전면 개편을 하지 않는다.

검증 명령:

```bash
uv run pytest tests/test_dashboard.py
```

```bash
cd frontend && npx tsc --noEmit
```

필요 시 전체 회귀:

```bash
uv run pytest
```

완료 후 task 처리 방식:

* 구현 시작 시 `status: working`으로 변경한다.
* 구현, 테스트, PR 생성 완료 후 `status: implemented`로 변경한다.
* PR 리뷰 완료 후 `status: reviewed`로 변경한다.
* merge 완료 후 `status: done`으로 변경하고 `docs/tasks/done/`으로 이동한다.
* 진행 중 결정이 필요하면 `결정 필요 사항`에 기록하고 사용자에게 확인한다.

## 11. 완료 기준

* `GET /api/v1/dashboard/overview`가 항상 `meta.partial_failure`와 `meta.failed_modules`를 포함한다.
* 모든 모듈 성공 시 `partial_failure`는 false이고 `failed_modules`는 빈 배열이다.
* 일부 모듈 실패 시 API는 200을 반환하고, 실패 모듈 snapshot은 `null`, 실패 모듈명은 `failed_modules`에 포함된다.
* 프론트 홈 화면은 전체 실패와 부분 실패를 구분해 표시한다.
* 기존 대시보드 카드 표시 로직은 정상 유지된다.
* `tests/test_dashboard.py`가 통과한다.
* TypeScript 검증이 통과한다.
* `.env`, `app/modules/ai`, DB migration, unrelated files를 변경하지 않는다.

## 12. PR 리뷰 체크리스트

* [ ] `dashboard`가 read-only BFF 역할을 유지하는가?
* [ ] 다른 모듈 model/repository를 직접 import하지 않았는가?
* [ ] 기존 overview 응답의 snapshot 필드가 하위 호환되게 유지되는가?
* [ ] exception detail이나 민감 정보가 API 응답에 노출되지 않는가?
* [ ] partial failure 테스트가 실제 실패 상황을 검증하는가?
* [ ] 프론트 타입과 백엔드 schema가 일치하는가?
* [ ] UI 변경이 작은 안내 수준으로 제한되어 있는가?
* [ ] DB migration이 불필요하게 추가되지 않았는가?

## 구현 결과

### 변경 파일

* `app/modules/dashboard/schemas.py` — `OverviewMeta` schema 추가, `OverviewResponse`에 `meta` 필드 추가
* `app/modules/dashboard/service.py` — snapshot 실패 수집 로직, `logger.error` 기록
* `tests/test_dashboard.py` — meta 기본 구조, 단일/다중 partial failure 테스트 3개 추가
* `frontend/types/index.ts` — `OverviewMeta` 인터페이스 추가, `OverviewResponse` 갱신
* `frontend/app/(dashboard)/page.tsx` — `partial_failure` 시 amber 안내 배너 추가

### 구현 요약

* `OverviewMeta(partial_failure, failed_modules)` Pydantic schema 추가
* dashboard service에서 각 snapshot 결과를 모듈명과 함께 순회하며 None/Exception 모두 failed_modules에 수집
* `logger.error`로 실패 기록, exception detail은 API 응답에 미노출
* 기존 snapshot 필드 하위 호환 유지
* 프론트 타입 동기화 및 홈 화면 조건부 배너 렌더링

### 추가/수정한 테스트

* `test_overview_empty_db` — meta 기본 구조 검증 추가
* `test_overview_partial_failure_meta` — finance 실패 시 200, meta.partial_failure=true, failed_modules 포함 확인
* `test_overview_multi_module_partial_failure` — finance+growth 동시 실패 시 failed_modules 두 모듈 포함 확인

### 실행한 검증 명령

```
uv run pytest tests/test_dashboard.py
uv run pytest
cd frontend && npx tsc --noEmit
```

### 테스트 결과

* `tests/test_dashboard.py`: 15 passed
* 전체: 268 passed, 3 warnings
* TypeScript: 오류 없음

### PR

GitHub 웹에서 PR 생성 필요 (gh CLI 미설치)
브랜치: `feature/TASK-001-dashboard-partial-failure-visibility`

### 남은 이슈

없음