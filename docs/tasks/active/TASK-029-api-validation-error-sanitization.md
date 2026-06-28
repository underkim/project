# TASK-029: API Validation Error Sanitization

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Ensure API validation errors remain user-friendly without exposing raw internal exception text. Some routers convert caught `ValueError` messages directly into HTTP response details.

## 2. Requirements

- In scope:
  - Audit routers for `detail=str(e)` or equivalent raw exception exposure.
  - Replace raw internal exception messages with explicit safe messages where needed.
  - Preserve correct status codes such as `422`, `404`, and `409`.
  - Add or update tests for invalid date ranges and other validation failures.
  - Keep frontend behavior compatible with sanitized error messages.
- Out of scope:
  - No broad exception middleware rewrite.
  - No schema redesign.
  - No stack trace logging changes unless required to avoid leaks.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `app/modules/growth/router.py`, `app/modules/travel/router.py`, `app/modules/ai/router.py`, module tests under `tests/`
- Current behavior:
  - Some endpoints catch `ValueError` and pass `str(e)` to `HTTPException`.
  - If future service code raises a more internal message, that text could become user-visible.
  - Existing tests verify status codes but may not consistently verify safe error details.

## 4. Design

- Backend/API:
  - Replace raw `str(e)` responses with route-specific safe messages.
  - Keep validation logic in schemas/services where it already lives.
  - Add targeted tests for representative invalid inputs.
- DB: No change.
- Frontend: No change expected; existing error handling should continue receiving a safe string.
- Security impact:
  - This task directly addresses information disclosure risk.
  - API responses must not expose stack traces, SQL details, credentials, file paths, or internal infrastructure details.

## 5. Test Plan

- Backend tests:
  - Run relevant module tests such as `tests/test_growth.py` and `tests/test_travel.py`.
  - Add assertions that invalid date range responses contain safe generic text.
  - Run full `uv run pytest` if feasible.
- Frontend/E2E tests: No frontend change expected.
- Security checks:
  - Search for `detail=str(e)` after implementation.
  - Confirm no raw exception messages are returned for known validation failures.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Raw exception details are not returned from validation error paths.
- Status codes remain correct.
- Tests cover sanitized validation responses.
- Existing module behavior remains compatible.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Sanitized messages are explicit and helpful.
- No internal details leak through API responses.
- Tests cover both status code and response detail.
- No unrelated router refactor is included.

## 9. Implementation Notes

### Audit

Searched `app/` for `detail=str(e)` / raw-exception exposure. Found exactly two
endpoints passing the caught exception text straight into the HTTP response:
- `app/modules/travel/router.py` `update_trip` → `HTTPException(422, detail=str(e))`
- `app/modules/growth/router.py` `update_book` → `HTTPException(422, detail=str(e))`

(`ai/router.py` uses `str(e)` only to *classify* the provider error and returns
generic fixed details — already safe, left unchanged.)

### Change

Replaced both with route-controlled fixed messages and dropped the `as e` bind:
- travel `update_trip` → `detail="종료일은 시작일 이후여야 합니다."`
- growth `update_book` → `detail="완료일은 시작일 이후여야 합니다."`

Status code stays `422`; the surrounding `404` (`result is None`) paths are
unchanged. The messages match what the service currently raises, so frontend
behavior is identical — but the detail is now a fixed string regardless of what
any future internal `ValueError` might contain, closing the information-disclosure
path.

### Tests

Extended the existing invalid-date-range tests to assert the exact safe detail
string and that no internal markers (`Traceback`, `Error`) leak:
- `tests/test_travel.py::test_update_trip_invalid_date_range_returns_422`
- `tests/test_growth.py::test_update_book_invalid_date_range_returns_422`

### Validation

- `uv run pytest tests/test_travel.py tests/test_growth.py -q` → **72 passed**.
- `uv run pytest -q` (full suite) → **296 passed**.
- Post-change grep for `detail=str(` in `app/` → **no matches**.

### Commit / push

- Commit: `5213341` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
