# TASK-010: Health Mutation In-Flight Guards

status: done
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal
Prevent duplicate health records and unclear save/delete behavior by adding explicit in-flight guards to exercise and sleep mutations on the health page.

The health page already supports creating, editing, and deleting exercise and sleep logs, but several mutation buttons remain clickable while requests are in flight. Quick repeated clicks can create duplicate exercise logs, send overlapping updates, or repeat delete requests, which makes the final UI state harder to trust.

## 2. Requirements
- In scope:
  - Disable repeated exercise create submissions while the request is pending.
  - Disable repeated sleep create submissions while the request is pending.
  - Disable repeated inline exercise and sleep edit saves while the request is pending.
  - Disable repeated delete confirmations while delete requests are pending.
  - Show a clear pending affordance using the existing button/loading style.
  - Preserve form input when a request fails.
  - Keep existing toast behavior, including the sleep duplicate-date conflict message.
- Out of scope:
  - Adding backend idempotency keys.
  - Adding database uniqueness for exercise logs.
  - Redesigning the health page layout or charts.
  - Changing summary calculations.

## 3. Current Structure Analysis
- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `frontend/app/(dashboard)/health/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/health/schemas.py`.
- Current behavior:
  - CSV export already has per-export pending state.
  - `submitExercise` and `submitSleep` do not currently expose a submit-pending state.
  - Inline edit save buttons can be clicked repeatedly while update requests are running.
  - Delete confirmation buttons can be clicked repeatedly while delete requests are running.
  - Failed create/update/delete requests show toasts, but repeated clicks can stack requests before the first response returns.

## 4. Design
- Backend/API: No change.
- DB: No change.
- Frontend:
  - Add focused pending state for exercise create, sleep create, exercise update, sleep update, exercise delete, and sleep delete.
  - Reuse existing `Loader2` and disabled button styles already present on the page.
  - Guard mutation handlers early when the matching operation is already pending.
  - Keep forms open and retain inputs on failed create/update requests.
  - Keep successful behavior unchanged: close the form/edit row, show success toast, reload data.
- Security impact:
  - No auth, DB, external service, or persistence schema change.
  - This reduces accidental duplicate writes but is not a security boundary.
  - Do not expose backend exception details in new error messages.

## 5. Test Plan
- Backend tests: No backend change.
- Frontend/E2E tests:
  - Add focused Playwright or component-level coverage if the project has an existing suitable pattern.
  - Validate that double-clicking exercise save only sends one create request.
  - Validate that double-clicking sleep save only sends one create request.
  - Validate that delete confirmation becomes disabled or guarded while pending.
- Manual validation:
  - Exercise create success and failure flows.
  - Sleep create success and duplicate-date conflict flow.
  - Inline edit save and delete flows for both exercise and sleep.
- Security checks:
  - Confirm no raw server exception text is displayed.

## 6. Claude Code Instructions
- Work directly on `develop`.
- Preserve unrelated changes.
- Implement only this task.
- Do not create a new task branch.
- Update `frontend/app/(dashboard)/health/page.tsx` using existing local state and styling patterns.
- Add tests only where the repository has an existing practical frontend/E2E pattern; otherwise document manual validation in the task.
- Commit and push to `develop`, then update this task to `implemented` with validation results.

## 7. Completion Criteria
- Exercise create cannot be submitted twice while pending.
- Sleep create cannot be submitted twice while pending.
- Exercise and sleep inline edit saves cannot overlap for the same row.
- Exercise and sleep delete confirmations cannot send repeated delete requests while pending.
- Pending controls show clear disabled/loading feedback.
- Failed requests preserve user-entered data.
- Existing health summary, chart, filter, and CSV export behavior remains unchanged.

## 8. PR Review Checklist
- Mutation guards are scoped to the matching operation and do not lock unrelated actions unnecessarily.
- Failed requests keep the user's in-progress input.
- Success and error toasts still appear as before.
- The sleep duplicate-date conflict message is preserved.
- No API, DB, or auth behavior was changed.
- No raw exception details are exposed to the user.
