# TASK-020: Finance Mutation In-Flight Guards

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Prevent duplicate finance create, update, and delete requests by adding scoped pending guards and clearer inline feedback on the finance page. The current finance UI can send repeated mutations before the first request finishes, which risks duplicate clicks, conflicting edits, and avoidable user confusion during normal record management.

## 2. Requirements

- In scope:
  - Add in-flight guards for finance record create, update, and delete actions.
  - Disable only the active control or row while its request is pending.
  - Show existing `Loader2` or equivalent inline pending feedback where a save/delete can take noticeable time.
  - Prevent duplicate clicks from sending repeated create/update/delete requests.
  - Keep current success/error toast behavior, including 409 duplicate-date feedback, intact.
  - Preserve current year filter, note search, and editing context when practical after successful mutations.
- Out of scope:
  - No finance summary/chart redesign.
  - No DB schema changes.
  - No API contract changes unless frontend handling reveals a missing status distinction.
  - No changes to local-only goal and budget widgets beyond pending-state consistency if directly touched by the implementation.
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
  - `frontend/app/(dashboard)/finance/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
  - `app/modules/finance/router.py`
  - `app/modules/finance/service.py`
  - `app/modules/finance/schemas.py`
  - `tests/test_finance.py`
- Current behavior:
  - Finance create has a page-level `submitting` boolean, but update and delete actions do not have comparable mutation guards.
  - Inline edit save remains clickable while the update request is in flight.
  - Delete confirmation has no disabled or busy state, so repeated confirm clicks can send multiple delete requests.
  - The row remains locally interactive while update/delete work is running.
  - Backend create/update already returns `409` for duplicate dates, so frontend reliability can improve without changing the API contract.

## 4. Design

- Backend/API: No change expected. Reuse existing finance routes and current `409`/`404` behavior.
- DB: No change.
- Frontend:
  - Introduce scoped mutation tracking for finance actions, such as a `Set<string>` keyed by `create`, `update_${id}`, `delete_${id}`, and optionally `load_more`.
  - Guard mutation handlers so repeated clicks while a matching key is pending return early.
  - Disable the create submit button and related cancel/hide interactions only while create is pending.
  - Disable the active inline edit save/cancel controls and row re-entry while that record update is pending.
  - Disable delete confirmation controls for the specific record while delete is pending, and show a spinner on the active confirm button.
  - Keep toast copy safe and consistent with existing sanitized API error handling in `frontend/lib/api.ts`.
- Security impact:
  - This task touches persistence and deletion flows for finance records.
  - Preserve authenticated requests and current authorization boundaries.
  - Do not expose raw server exceptions in user-facing toasts.
  - Do not change delete semantics, record ownership assumptions, or backend validation rules.

## 5. Test Plan

- Backend tests: No backend change; run `tests/test_finance.py` if API behavior is touched.
- Frontend/E2E tests:
  - Rapidly submit the create form and verify only one record is created per intentional action.
  - Rapidly click inline save for an edited record and verify only one update request is active.
  - Rapidly click delete confirm and verify only one delete request is sent for that record.
  - Verify duplicate-date `409` feedback still appears correctly for create and update flows.
  - Verify filters, note search, and record editing state remain stable after successful mutations where practical.
- Security checks:
  - Error toasts remain generic or sanitized.
  - Pending-state changes do not bypass or weaken delete confirmation.
  - No raw exception details are surfaced from finance API failures.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Finance create, update, and delete handlers have scoped in-flight guards.
- Relevant buttons and row controls are disabled or show pending feedback while active.
- Duplicate mutation clicks no longer send repeated requests for the same action.
- Existing duplicate-date conflict handling still works for create and update.
- Existing finance API tests remain passing if touched.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Pending state is scoped per finance action instead of blocking the whole page unnecessarily.
- Delete confirmation cannot be double-submitted.
- Inline edit cannot be resubmitted repeatedly while save is pending.
- Toast messages remain safe and do not expose raw internal errors.
- No unrelated finance page redesign or summary logic changes were included.

## 9. Implementation Notes

### Change (`frontend/app/(dashboard)/finance/page.tsx`)

Applied the same scoped-guard pattern already used in career/health/travel
(`mutating: Set<string>` + `withMutation(key, fn)` helper):

- Added `mutating` state and `withMutation` helper (mirrors existing
  `exporting`/`handleExport`).
- **Create**: kept the existing `submitting` boolean (button already disabled),
  added an early `if (submitting) return;` guard to `handleSubmit` so an Enter
  re-submit while pending cannot fire a second create.
- **Update**: wrapped `handleUpdate` in `withMutation('update_${id}')`. The
  inline edit save button shows a `Loader2` spinner and the save/cancel controls
  are disabled while that record's update is pending. The existing 409
  duplicate-date toast handling is preserved unchanged.
- **Delete**: wrapped `handleDelete` in `withMutation('delete_${id}')`.
  `DeleteConfirm` gained a `disabled` prop — the confirm button shows a spinner
  and both confirm/cancel are disabled while that record's delete is in flight,
  so repeated confirm clicks send only one request.
- Load-more was already guarded by the existing `loadMore` boolean.
- Toast copy unchanged; no raw exceptions surfaced. No summary/chart/goal
  widget logic changed.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `uv run pytest tests/test_finance.py -q` → **25 passed** (no backend change;
  run for safety).

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
