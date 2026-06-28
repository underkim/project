# TASK-011: Finance Record Date Editing

status: done
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal
Allow users to correct the date of an existing finance record without deleting and recreating the record.

The finance create flow captures `record_date`, and records are displayed by date, but the inline edit UI only allows changing amounts and note. The backend update schema also does not currently expose `record_date`, so a date typo requires a destructive workaround that can break the user's workflow.

## 2. Requirements
- In scope:
  - Add optional `record_date` support to finance record updates.
  - Add a date input to the existing inline finance edit row.
  - Preserve existing amount and note editing behavior.
  - Preserve the existing unique-date conflict behavior when the edited date collides with another finance record.
  - Show a clear error toast when a date update fails.
  - Refresh summary and table data after a successful date edit.
- Out of scope:
  - Changing finance calculations.
  - Adding bulk edit.
  - Changing chart design.
  - Changing export format.
  - Adding new DB columns or tables.

## 3. Current Structure Analysis
- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `frontend/app/(dashboard)/finance/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/finance/schemas.py`, `app/modules/finance/router.py`.
- Current behavior:
  - `AssetRecordCreate` requires `record_date`.
  - `AssetRecordUpdate` supports amounts and note, but not `record_date`.
  - The frontend inline edit form shows the date as read-only text.
  - The API create endpoint maps duplicate dates to HTTP 409, but update conflict behavior should be verified.

## 4. Design
- Backend/API:
  - Add `record_date: date | None = None` to `AssetRecordUpdate`.
  - Ensure `service.update_record()` applies `record_date` safely when present.
  - Ensure duplicate-date conflicts during update return a user-safe HTTP 409 message rather than a raw server error.
- DB: No schema change.
- Frontend:
  - Include `record_date` in `editForm` and `financeApi.updateRecord()` input type.
  - Replace the read-only date cell in inline edit mode with a date input.
  - Keep the current row-click edit behavior and table layout.
  - On conflict, show a clear toast such as "A finance record already exists for that date." using the existing localized style.
- Security impact:
  - This touches API input and persistence.
  - Continue using Pydantic date parsing and ORM-safe updates.
  - Do not expose raw `IntegrityError` details or database constraint names.
  - Keep authentication requirements unchanged on all finance endpoints.

## 5. Test Plan
- Backend tests:
  - Add or update finance tests for successful `record_date` update.
  - Add conflict test: updating a record date to another existing record date returns HTTP 409 with safe detail.
  - Add auth check if existing finance update auth coverage does not cover this path.
- Frontend/E2E tests:
  - Validate inline edit can change the record date and reloads the table/summary.
  - Validate duplicate date failure keeps the edit form open and shows an error.
- Security checks:
  - Confirm the conflict response does not include raw DB error text.
  - Confirm unauthenticated update still returns 401.

## 6. Claude Code Instructions
- Work directly on `develop`.
- Preserve unrelated changes.
- Implement only this task.
- Do not create a new task branch.
- Update backend schemas/service/router only as needed for finance date updates.
- Update frontend API types and the finance inline edit UI.
- Run focused backend finance tests and frontend type check.
- Commit and push to `develop`, then update this task to `implemented` with validation results.

## 7. Completion Criteria
- Users can edit a finance record's date from the existing inline edit row.
- Backend accepts optional `record_date` in finance updates.
- Duplicate date updates return a safe 409 response.
- The frontend shows a clear error and preserves edit input on failed date update.
- Successful date updates refresh summary, table, and charts.
- Existing create, delete, export, filter, and goal behavior remains unchanged.

## 8. PR Review Checklist
- `record_date` update is optional and does not break existing update requests.
- Duplicate-date conflicts are handled safely.
- Auth requirements remain unchanged.
- Frontend type definitions match backend response/request behavior.
- Inline edit layout remains usable on narrow screens.
- No DB migration was added unnecessarily.
