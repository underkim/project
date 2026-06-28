# TASK-015: Dashboard Overview Retry State

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Improve the dashboard overview failure path so users can retry loading data without leaving the page. The dashboard currently renders a plain error message when the overview request fails, which gives no recovery action and can leave stale error state around refresh attempts.

## 2. Requirements

- In scope:
  - Add a visible retry action to the dashboard overview error state.
  - Ensure retry clears the previous error and shows a loading state while the request is pending.
  - Keep `useAiRefresh` behavior intact.
  - Preserve the existing partial-failure banner for successful responses with failed modules.
  - Use existing dashboard styling and icon patterns.
- Out of scope:
  - No backend aggregation changes.
  - No changes to dashboard card content or metrics.
  - No change to AI weekly report generation.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `README.md`
  - `docs/adr/0001-modular-monolith.md`
  - `docs/adr/0002-bff-pattern.md`
  - `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `frontend/app/(dashboard)/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
  - `app/modules/dashboard/service.py`
- Current behavior:
  - `DashboardPage` loads `dashboardApi.getOverview()` on mount.
  - A full request failure sets `error` and renders a plain text error.
  - There is no retry button in the full error state.
  - The `load()` helper does not explicitly reset `error` before a new request.
  - Partial module failures already have a separate banner when the overview response succeeds.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Update `load()` to set loading state and clear previous errors before requesting overview data.
  - Render a compact error panel with a retry button when the full overview request fails.
  - Disable the retry button while loading.
  - Keep partial-failure banner behavior unchanged for successful responses.
  - Avoid resetting user-local goals when retrying; only overview data/error/loading state should change.
- Security impact:
  - This task touches API error display.
  - Do not show raw exception messages or stack traces.
  - Use the already sanitized `err.message` from `frontend/lib/api.ts` or a generic fallback.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests:
  - Mock or manually simulate overview request failure and verify an error panel with retry appears.
  - Click retry and verify loading state appears, previous error clears, and successful data renders.
  - Verify partial failures still show the existing partial-failure banner rather than the full error panel.
  - Verify AI-triggered refresh still calls the same load path.
- Security checks:
  - Error UI must not display stack traces, connection strings, or raw backend exception text.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Full dashboard overview errors include a retry action.
- Retry clears stale error state and shows loading feedback.
- Successful retry renders dashboard cards again.
- Partial-failure banner behavior is unchanged.
- No backend or DB behavior changed.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Retry does not create duplicate overlapping overview requests.
- Error text is safe and user-friendly.
- Partial failures and full failures remain visually distinct.
- Existing dashboard layout remains stable on desktop and mobile.
- `useAiRefresh` still works.
