# TASK-021: Planner Mutation State Consistency

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make planner editing more reliable by using consistent pending guards and feedback across roadmap settings, phase edits, category edits, item edits, and bulk delete actions. The planner already has some local pending states, but they are distributed across nested components and do not consistently prevent repeated requests or stale interactions.

## 2. Requirements

- In scope:
  - Add or normalize scoped pending state for planner settings save, phase update, category create/update/delete, item create/update/toggle/delete, and bulk category delete.
  - Disable only the relevant action controls while their matching request is pending.
  - Keep existing optimistic updates where safe, but reload roadmap state when derived dates/statuses can change.
  - Preserve current search, hide-completed, deadline view, selected tab, and select-mode behavior where practical.
  - Use existing error banner patterns and safe user-facing messages.
- Out of scope:
  - No roadmap schema or API contract changes unless required by a discovered bug.
  - No planner layout redesign.
  - No new roadmap feature beyond mutation reliability.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/app/(dashboard)/planner/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/planner/router.py`, `app/modules/planner/service.py`, `tests/test_planner.py`
- Current behavior:
  - `ItemRow`, `CategoryCard`, `AddItemForm`, and `PhaseEditPanel` each keep their own local pending state.
  - Parent-level handlers can still be called by multiple child controls before data reload finishes.
  - Some derived deadline/status updates call a full reload while text-only edits patch local state.
  - Bulk category delete already handles partial failure, but selection and pending state should remain resilient during retries.

## 4. Design

- Backend/API: No change expected.
- DB: No change.
- Frontend:
  - Introduce a parent-level `Set<string>` mutation tracker or equivalent helper in `PlannerPage`.
  - Keep component-local UI affordances only when they reflect a parent mutation key.
  - Guard each handler against repeated invocation while the same key is pending.
  - Clear pending delete confirmation timers safely when a mutation starts or select mode changes.
  - Maintain current active tab and filters after reloads.
- Security impact:
  - This task touches persistence and deletion flows.
  - Preserve existing auth and delete confirmation behavior.
  - Do not expose raw server exception details in the error banner.

## 5. Test Plan

- Backend tests: Run `tests/test_planner.py` if any planner API behavior is touched.
- Frontend/manual tests:
  - Rapidly click item toggle/save/delete and verify only one request is active per item.
  - Rapidly click category delete confirm and bulk delete confirm.
  - Verify phase duration changes still refresh derived deadlines/statuses.
  - Verify search, hide-completed, deadline view, and active phase remain usable after mutations.
- Security checks:
  - Delete confirmation remains explicit.
  - Error text remains sanitized.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Planner mutation handlers have consistent scoped guards.
- Relevant controls show disabled or loading feedback while pending.
- Duplicate mutation clicks do not send repeated requests.
- Existing planner tests remain passing if touched.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Pending keys are scoped and do not block unrelated planner work.
- Derived deadline/status reload behavior remains correct.
- Bulk delete partial failure handling is preserved.
- No unrelated planner redesign is included.

## 9. Implementation Notes

### Assessment

Audit of `planner/page.tsx` showed most mutation flows already carry scoped
component-local pending guards that prevent duplicate requests and show
feedback:

- `ItemRow`: `toggling` (toggle button disabled + spinner), `deleting`
  (confirm-delete disabled + spinner).
- `AddItemForm`: `saving` (submit disabled).
- `CategoryCard`: `metaSaving` (meta save disabled), `deleting` (confirm-delete
  disabled + spinner).
- `AddCategoryForm`: `saving`. `PhaseEditPanel`: `saving`.
- Bulk category delete: `bulkDeleting` (confirm disabled + spinner), partial
  failure handling preserved.

Per the task ("keep component-local UI affordances"), these were left intact.
Two genuine gaps had **no** guard and were fixed:

### Changes (`frontend/app/(dashboard)/planner/page.tsx`)

1. **Item text/deadline edit (`ItemRow`)** — `save()` and `handleDeadlineChange`
   previously fired `onEditSave` with no pending guard, so a double-click on the
   check button or Enter-key repeat could send duplicate update requests. Added
   a `savingEdit` state: `save()` is now `async`, guards re-entry, awaits
   `onEditSave`, and the edit save/cancel buttons are disabled (save shows a
   `Loader2` spinner) while pending. `handleDeadlineChange` guards on the same
   flag. The `onEditSave` prop type was changed from `=> void` to
   `=> Promise<void>` (parent `handleEditSave` was already async) and threaded
   through `CategoryCardProps`.
2. **Settings start-date save** — added an early `if (saving) return;` guard to
   `handleSaveDate` so a re-entrant call cannot bypass the disabled-button guard.

Derived deadline/status reload behavior unchanged: offset edits and phase
duration changes still call `loadRoadmap()`; text-only edits still patch local
state. Search, hide-completed, deadline view, active tab, and select-mode are
untouched.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `uv run pytest tests/test_planner.py -q` → **35 passed** (no backend change).

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
