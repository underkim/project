# TASK-014: Travel Mutation Feedback and Guards

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make travel edits feel reliable by preventing duplicate mutation requests and showing clear feedback when checklist, plan, trip update, or delete actions fail. The current page uses optimistic updates in several places, but some failures silently reload or fail without telling the user what happened.

## 2. Requirements

- In scope:
  - Add in-flight guards for travel trip create/update/delete, checklist toggle/delete/add, and plan add/update/delete actions.
  - Disable only the control currently performing a mutation.
  - Show a clear toast on mutation failure and reload or restore local state where needed.
  - Preserve the optimistic UI behavior where it is already useful, but make rollback/reload visible to the user.
  - Keep the expanded trip and current filters/search stable after successful mutations where practical.
- Out of scope:
  - No API contract changes unless a missing status code prevents correct UX.
  - No DB schema changes.
  - No redesign of the travel page layout.
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
  - `frontend/app/(dashboard)/travel/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
  - `app/modules/travel/router.py`
  - `app/modules/travel/service.py`
  - `tests/test_travel.py`
- Current behavior:
  - Travel page keeps all trip UI state locally and refreshes from `travelApi.listTrips()`.
  - Some actions optimistically update local state and call `load()` on failure.
  - Checklist add and plan add catch failures silently.
  - Delete and toggle actions can be triggered repeatedly before the first request finishes.
  - Several mutation controls have no busy state, so users cannot tell whether an action is pending.

## 4. Design

- Backend/API: No change expected.
- DB: No change.
- Frontend:
  - Add mutation tracking in `TravelPage`, using stable keys such as `trip_delete_${id}`, `check_toggle_${id}`, `plan_add_${tripId}`, and `plan_delete_${id}`.
  - Pass pending state into `TripCard`, `ChecklistRow`, and plan item controls as needed.
  - Disable only the active button/input while its request is pending.
  - For optimistic delete/toggle operations, show an error toast if the request fails and reload server state.
  - For add/update operations, show an error toast and keep user-entered text when the save fails where practical.
  - Use existing `showToast` conventions from other dashboard pages.
- Security impact:
  - This task touches user input mutation flows and deletion actions.
  - Do not expose raw exception messages in user-facing toasts.
  - Preserve authenticated API calls through `frontend/lib/api.ts`.
  - Do not change authorization behavior or deletion semantics.

## 5. Test Plan

- Backend tests: No backend change; run existing `tests/test_travel.py` if API behavior is touched.
- Frontend/E2E tests:
  - Manually verify duplicate clicks on trip delete, checklist toggle, and plan delete only send one active request per item.
  - Manually verify failed checklist/plan add shows an error toast instead of failing silently.
  - Manually verify successful add/update/delete still updates the visible trip card.
  - Manually verify filters, search text, and expanded trip do not reset unnecessarily after successful actions.
- Security checks:
  - Failed API responses should show generic safe messages, not raw server traces.
  - Delete actions must still require the existing explicit user click.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Travel mutation actions have item-scoped in-flight guards.
- Duplicate clicks while an action is pending are ignored or disabled.
- Silent catch blocks for checklist/plan mutations are replaced with user-visible error feedback.
- Optimistic failures reload or restore state with a toast.
- Existing travel API tests remain passing.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Pending state is scoped per action and does not block the whole page unnecessarily.
- Error toasts are safe and helpful.
- Optimistic updates cannot leave stale UI after a failed request.
- No unrelated travel page redesign was included.
- No raw exception details or secrets are exposed.
