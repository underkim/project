# TASK-002: AI Router Error Sanitization

status: implemented
type: improvement
priority: high
created_by: codex
implemented_by: claude
reviewed_by:

created_at: 2026-06-28
approved_at: 2026-06-28
implemented_at: 2026-06-28
reviewed_at:
merged_at:

branch: feature/TASK-002-ai-router-error-sanitization
pr: (gh CLI 미설치 — GitHub 웹에서 PR 생성 필요)
merge_commit:

---

## 1. Goal

Prevent `app/modules/ai/router.py` from returning raw exception text to clients while preserving the current AI API contract and expected status-code behavior.

This improvement is needed because the AI endpoints currently build `HTTPException.detail` values with `str(e)`, and the frontend intentionally surfaces `detail` strings to the user. That combination can expose internal provider messages, infrastructure details, and unexpected exception text to authenticated users.

## 2. Requirements

### In Scope

* Sanitize unexpected error responses from:
  * `POST /api/v1/ai/chat`
  * `GET /api/v1/ai/weekly-report`
  * `POST /api/v1/ai/execute`
* Preserve existing success response schemas and request payloads.
* Keep explicit status-code handling for known AI provider failures:
  * quota exhaustion -> `429`
  * invalid API key / permission denied -> `401`
  * missing server-side AI configuration -> `503`
* Replace `traceback.print_exc()` with structured server-side logging that keeps diagnostic detail out of API responses.
* Add tests that verify raw exception text is not returned to API callers.

### Out of Scope

* Changes to AI prompt logic in `app/modules/ai/service.py`
* Transaction-flow changes in the AI service layer
* New database schema, migration, or seed updates
* Frontend feature redesign
* Broader global exception-handler refactors across unrelated modules

### Security Impact

This task directly affects authenticated API responses and an external integration (`Gemini`). The implementation must ensure that:

* raw provider messages are not exposed to users
* stack traces are not returned in `detail`
* connection errors, model errors, and unexpected internal exceptions do not leak infrastructure hints
* logging remains server-side only

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`

### Relevant Files

* `app/modules/ai/router.py`
* `app/modules/ai/service.py`
* `tests/test_ai_routes.py`
* `frontend/lib/api.ts`
* `frontend/components/AiModal.tsx`

### Observed Current Behavior

* `app/modules/ai/router.py` currently catches broad exceptions in `chat`, `weekly_report`, and `execute`.
* For known provider failures, the router maps some strings such as `RESOURCE_EXHAUSTED`, `quota`, `API_KEY_INVALID`, and `PERMISSION_DENIED` to user-facing `HTTPException`s.
* For all other failures, the router currently returns `detail=f"...{err}"`, where `err = str(e)`.
* `frontend/lib/api.ts` copies `response.data.detail` into `err.message`.
* `frontend/components/AiModal.tsx` displays that message directly to the user.

### Risk Summary

The current pattern makes internal exception text user-visible, including:

* upstream provider wording
* request or environment hints embedded in exception messages
* database or infrastructure failure text
* unexpected delete-path errors from `/api/v1/ai/execute`

## 4. Impact Scope

### Backend

* `app/modules/ai/router.py`
  * introduce a shared error-mapping helper for AI router endpoints
  * replace raw-string response details with stable sanitized messages
  * replace `traceback.print_exc()` with logger-based exception logging

### Frontend

* No required code changes
* Existing frontend behavior should continue to work because it already displays `detail`
* The backend change must ensure that any surfaced `detail` is safe to show

### Database / Migration

* No table changes
* No column changes
* No migration required

### Tests

* `tests/test_ai_routes.py`
  * add coverage for sanitized `500` responses from `/chat`, `/weekly-report`, and `/execute`
  * verify that known mapped failures still use the expected status codes

## 5. Design Decision

Adopt a router-local sanitization layer in `app/modules/ai/router.py` rather than changing the AI service implementation or the global FastAPI error model.

### Chosen Approach

* Add a small helper that inspects exception text for known provider cases and returns the correct `HTTPException`.
* For all other errors:
  * log the original exception with `logger.exception(...)`
  * return a generic, user-safe `detail` message
* Keep endpoint-specific generic messages so callers still know whether chat, report generation, or delete execution failed.

### Rejected Alternative 1

Handle everything through a new app-wide exception middleware.

Reason:
This is broader than needed for a single concrete improvement task and increases cross-module risk.

### Rejected Alternative 2

Keep current behavior and rely on frontend fallback text.

Reason:
The frontend already prefers server `detail`, so backend leakage remains the root problem.

## 6. API Design

No endpoint paths or request bodies change.

### Endpoints

| Method | Path | Change |
| ------ | ---- | ------ |
| POST | `/api/v1/ai/chat` | Unexpected failures return a generic safe `detail` instead of raw exception text |
| GET | `/api/v1/ai/weekly-report` | Unexpected failures return a generic safe `detail` instead of raw exception text |
| POST | `/api/v1/ai/execute` | Unexpected failures return a generic safe `detail` instead of raw exception text |

### Expected Error Behavior

* Known quota/provider exhaustion: `429`
* Known invalid-key/permission errors: `401`
* Missing `gemini_api_key`: `503`
* Unexpected internal failures: `500` with sanitized `detail`

### Example Safe Responses

```json
{"detail":"AI processing failed. Please try again later."}
```

```json
{"detail":"Weekly report generation failed. Please try again later."}
```

```json
{"detail":"Delete execution failed. Please try again later."}
```

The final wording can be adjusted to match existing Korean UX tone, but it must remain generic and must not interpolate `str(e)`.

## 7. DB Design

* No schema changes
* No relationship changes
* No index changes
* No migration required

## 8. Frontend Design

No frontend implementation is required.

Validation expectations:

* `frontend/lib/api.ts` should continue passing through safe backend `detail` text.
* `frontend/components/AiModal.tsx` should continue showing backend-provided detail without exposing internals, because the backend will now sanitize it.

## 9. Test Plan

### Backend Tests

Add or update tests in `tests/test_ai_routes.py` to cover:

* `/api/v1/ai/chat`
  * unexpected exception -> `500`
  * response `detail` does not contain raw exception text
* `/api/v1/ai/weekly-report`
  * unexpected exception -> `500`
  * response `detail` does not contain raw exception text
* `/api/v1/ai/execute`
  * unexpected exception -> `500`
  * response `detail` does not contain raw exception text
* known quota error mapping still returns `429`
* known invalid-key/permission mapping still returns `401`

Suggested negative test strings:

* `"database password leaked"`
* `"API_KEY_INVALID"`
* `"RESOURCE_EXHAUSTED"`
* `"connection string postgresql://..."`

The raw strings used to trigger exceptions must not be echoed back in sanitized responses except for the known-category detection logic.

### Frontend Validation

No frontend tests are required for this task.

Optional manual verification after implementation:

* confirm AiModal shows the sanitized text returned by the API

## 10. Claude Code Implementation Instructions

This task is already `status: approved`. Claude Code may implement it immediately.

### Files To Edit

* `app/modules/ai/router.py`
* `tests/test_ai_routes.py`

### Implementation Sequence

1. Re-read `CLAUDE.md`, `README.md`, and ADRs `0001` through `0003`.
2. In `app/modules/ai/router.py`, remove direct user-facing interpolation of `str(e)` from all three AI endpoints.
3. Introduce a shared helper for AI router exception mapping to avoid copy-pasted logic drifting between endpoints.
4. Replace `traceback.print_exc()` with `logging.getLogger(__name__).exception(...)`.
5. Preserve the current success payloads and known status-code mappings.
6. Add tests in `tests/test_ai_routes.py` that patch the router/service path to raise exceptions and assert sanitized results.
7. Keep the change narrow. Do not modify `app/modules/ai/service.py` unless a tiny import-level adjustment is strictly required for the router tests.

### Constraints

* Do not change DB schema or migrations.
* Do not alter AI transaction handling rules documented in `CLAUDE.md`.
* Do not introduce raw exception text into API responses.
* Do not broaden this into a repository-wide error-handling refactor.

### Validation Commands

Document these in the task after implementation, but do not run them during planning:

```bash
uv run pytest tests/test_ai_routes.py
```

If Claude Code touches any shared behavior and needs broader confidence:

```bash
uv run pytest
```

## 11. Completion Criteria

* No AI router endpoint returns `detail` values built from `str(e)` for unexpected failures.
* Known quota and invalid-key/permission failures still map to the correct status codes.
* Missing AI configuration still returns `503`.
* `traceback.print_exc()` is removed from `app/modules/ai/router.py`.
* New tests verify sanitized behavior and prevent regression.
* No database, migration, or unrelated frontend files are changed.

## 12. PR Review Checklist

* [ ] Raw exception text is never returned from `POST /api/v1/ai/chat`
* [ ] Raw exception text is never returned from `GET /api/v1/ai/weekly-report`
* [ ] Raw exception text is never returned from `POST /api/v1/ai/execute`
* [ ] Known provider failures still map to `429` and `401` as intended
* [ ] Missing configuration still returns `503`
* [ ] Logging remains server-side only and uses `logger.exception(...)`
* [ ] No AI service transaction rules were changed
* [ ] No migration or unrelated refactor was introduced

## 구현 결과

### 변경 파일

* `app/modules/ai/router.py` — traceback 제거, logger 도입, `_map_ai_exception()` helper 추가, 세 엔드포인트 str(e) 노출 제거
* `tests/test_ai_routes.py` — sanitized 500 테스트 3개, 429/401 매핑 테스트 2개 추가

### 구현 요약

* `import traceback` → `import logging` + `logger = logging.getLogger(__name__)`
* `_map_ai_exception(e, generic_detail)` 공통 helper: 알려진 provider 오류(quota→429, invalid-key→401)는 기존 동작 유지, 그 외는 `logger.exception()`으로 서버 로깅 후 generic detail로 500 반환
* `/chat`, `/weekly-report`, `/execute` 세 엔드포인트의 `except` 블록을 `raise _map_ai_exception(...)` 한 줄로 교체

### 추가/수정한 테스트

* `test_chat_unexpected_exception_returns_sanitized_500` — 민감 문자열이 detail에 없음 확인
* `test_weekly_report_unexpected_exception_returns_sanitized_500` — 민감 문자열이 detail에 없음 확인
* `test_execute_unexpected_exception_returns_sanitized_500` — 민감 문자열이 detail에 없음 확인
* `test_chat_quota_exhausted_returns_429` — RESOURCE_EXHAUSTED → 429
* `test_chat_invalid_key_returns_401` — API_KEY_INVALID → 401

### 실행한 검증 명령

```
uv run pytest tests/test_ai_routes.py
uv run pytest
```

### 테스트 결과

* `tests/test_ai_routes.py`: 31 passed
* 전체: 271 passed, 3 warnings

### PR

GitHub 웹에서 PR 생성 필요 (gh CLI 미설치)
브랜치: `feature/TASK-002-ai-router-error-sanitization`

### 남은 이슈

없음
