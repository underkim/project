# TASK-006: CSV Export Download Feedback

status: working
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28

branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Improve the existing CSV export experience so users get clear per-export progress and result feedback, and accidental repeated clicks do not trigger duplicate downloads or duplicate export API calls.

This is a low-risk usability and reliability improvement for an existing feature. CSV export is already available across finance, health, growth, career, and travel pages, but the UI currently fires the download helper directly from icon buttons with no local busy state. A user can click repeatedly while the request is in flight, causing duplicate requests, duplicate browser downloads, and repeated toast messages.

## 2. Requirements

### In Scope

* Add reusable frontend state/utility support for CSV export buttons so each export action can show an in-progress state and disable only the active export button while the request is running.
* Apply the behavior to all existing CSV export entry points:
  * finance export
  * health exercise export
  * health sleep export
  * growth books export
  * growth English export
  * career export
  * travel export
* Preserve the current API endpoints and downloaded filenames.
* Keep the existing success and error toast behavior, but make sure the initiating button state always returns to idle after success or failure.
* Add focused frontend verification coverage or test notes that confirm duplicate clicks do not create duplicate requests for at least one representative export button.

### Out of Scope

* Changing CSV column structure, content, ordering, encoding, or backend export query behavior.
* Adding new export endpoints.
* Changing authentication, authorization, or token handling.
* Reworking page layouts or replacing the existing icon-button placement.

### Security Impact

This task touches authenticated CSV export workflows and file download initiation.

* Export endpoints must remain authenticated through the existing `get_current_user` backend dependency.
* Frontend changes must not log tokens, CSV contents, request headers, or backend response bodies.
* Error toasts should stay generic and must not expose raw exception details, infrastructure details, credentials, or response internals.
* Download URLs must continue to use browser-created object URLs from the authenticated response blob; do not introduce query-token downloads or unauthenticated public links.
* The task does not change database writes or deletion behavior.

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`

### Relevant Files Reviewed

* `frontend/lib/api.ts`
* `frontend/app/(dashboard)/finance/page.tsx`
* `frontend/app/(dashboard)/health/page.tsx`
* `frontend/app/(dashboard)/growth/page.tsx`
* `frontend/app/(dashboard)/career/page.tsx`
* `frontend/app/(dashboard)/travel/page.tsx`
* `frontend/e2e/finance.spec.ts`
* `frontend/e2e/health.spec.ts`
* `app/modules/export/router.py`
* `app/modules/export/service.py`
* `tests/test_export.py`

### Observed Current Behavior

* `frontend/lib/api.ts` implements `_downloadCsv(url, filename)` and exposes `exportApi.finance()`, `exportApi.exercise()`, `exportApi.sleep()`, `exportApi.books()`, `exportApi.english()`, `exportApi.career()`, and `exportApi.travel()`.
* Each dashboard page calls the relevant `exportApi` method directly from an icon button.
* Export buttons do not track whether their request is in flight.
* A rapid double-click can call the same export endpoint more than once before the first request completes.
* The backend export router already requires authentication and returns CSV attachments with stable filenames.
* Existing backend tests cover route registration, authentication requirement, empty exports, content disposition, and representative CSV content.

### Risk Summary

The current behavior can create duplicate downloads and duplicate backend work from a single user intent. This is especially noticeable on slower Render cold starts or network delays, where users may click again because the icon button gives no immediate indication that work has started.

## 4. Impact Scope

### Frontend

Expected files:

* `frontend/lib/api.ts`
  * Keep the export API methods and filenames stable.
  * If useful, return a status value or allow the caller to manage loading through the existing promise.
* Dashboard pages with CSV export buttons:
  * `frontend/app/(dashboard)/finance/page.tsx`
  * `frontend/app/(dashboard)/health/page.tsx`
  * `frontend/app/(dashboard)/growth/page.tsx`
  * `frontend/app/(dashboard)/career/page.tsx`
  * `frontend/app/(dashboard)/travel/page.tsx`
* Optional small shared frontend helper/component if it reduces repeated logic without creating broad abstraction.

### Backend

No backend behavior change is required.

The backend export router and service should remain unchanged unless Claude Code finds a very small typing or response-header issue directly required by the frontend behavior. If backend changes are made, keep them limited and update tests accordingly.

### Database / Migration

No database or Alembic migration changes.

### Tests

Frontend E2E or focused frontend coverage should verify at least one representative export button:

* the button becomes disabled or visibly busy while the export request is in flight
* rapid repeated clicks result in only one export request
* the button returns to idle after the request resolves or fails

Existing backend export tests should continue to pass.

## 5. Design Decision

Use local frontend loading state around existing export API calls instead of changing the backend contract.

### Chosen Approach

* Keep each `exportApi.*()` method as a promise-returning action.
* Add a small reusable `handleExport` pattern or helper on pages that:
  * accepts an export key or action name
  * skips the call if that export key is already active
  * sets the key active before awaiting the promise
  * clears the key in `finally`
* Disable only the relevant export button while it is active.
* Show a small spinner or accessible busy state in place of, or next to, the current `Download` icon.
* Preserve existing toast messages from the shared download helper unless a better shared message can be added without duplicating page-specific strings.

### Rejected Alternative 1

Change backend export endpoints to reject duplicate requests.

This would add server-side complexity without solving the immediate user feedback problem. Duplicate export requests are best avoided at the UI action boundary.

### Rejected Alternative 2

Disable all page actions during export.

CSV export is read-only and should not block unrelated page interactions. Only the active export button needs to be disabled.

## 6. API Design

No API contract changes.

Existing endpoints must remain:

* `GET /api/v1/export/finance`
* `GET /api/v1/export/health/exercise`
* `GET /api/v1/export/health/sleep`
* `GET /api/v1/export/growth/books`
* `GET /api/v1/export/growth/english`
* `GET /api/v1/export/career`
* `GET /api/v1/export/travel`

Expected behavior remains:

* authenticated requests return `200` with a CSV attachment
* unauthenticated requests return `401`
* frontend failures show a generic error toast

## 7. DB Design

No DB changes.

CSV export remains read-only and uses existing module data.

## 8. Frontend Design

### Required UX Changes

* Each export icon button should provide immediate feedback after click:
  * disabled state while active
  * visible spinner or comparable loading indicator
  * `aria-busy` or accessible label/title update when active
* Rapid repeated clicks while active should be ignored.
* When an export finishes or fails, the button should return to the normal `Download` icon state.
* Existing icon placement and visual density should remain consistent with current dashboard pages.

### Implementation Notes

* Prefer `lucide-react` icons already used in the pages. If a spinner icon is used, use an existing lucide icon such as `Loader2` with `animate-spin`.
* Avoid adding visible instructional text. Use existing tooltips/titles and compact icon affordances.
* For pages with multiple export buttons, such as health and growth, track the active export key so one export button can be busy without disabling the other.
* Do not introduce global state for export loading unless there is a clear need.

## 9. Test Plan

### Frontend E2E Coverage

Add or update a Playwright test in the repo's existing E2E style, preferably in a page that already has coverage such as `frontend/e2e/finance.spec.ts`.

Representative test approach:

1. Intercept the relevant export request, delay the response, and count matching requests.
2. Navigate to the page.
3. Click the CSV export button twice quickly.
4. Assert the matching request count is `1`.
5. Assert the button is disabled or has an active/busy indicator while the delayed request is pending.
6. Fulfill or allow the request to complete.
7. Assert the button returns to idle.

### Backend Tests

No new backend tests are required unless backend export behavior changes.

If backend export behavior changes, run and update:

```bash
uv run pytest tests/test_export.py
```

### Suggested Validation Commands

Claude Code should run the focused checks needed for the final implementation, for example:

```bash
cd frontend
npm run lint
npx playwright test frontend/e2e/finance.spec.ts
```

If shared frontend API typing changes, also run the repository's available type or build check if configured.

## 10. Claude Code Implementation Instructions

### Branch Workflow

* Implement directly on `develop`.
* Do not create a new feature or fix branch for this normal task implementation.
* Before starting, confirm it is safe to work on `develop` and do not overwrite unrelated uncommitted changes.
* After implementation and validation, commit and push to `develop`, then update this task to `implemented`.

### Files To Edit

Likely frontend files:

* `frontend/lib/api.ts`
* `frontend/app/(dashboard)/finance/page.tsx`
* `frontend/app/(dashboard)/health/page.tsx`
* `frontend/app/(dashboard)/growth/page.tsx`
* `frontend/app/(dashboard)/career/page.tsx`
* `frontend/app/(dashboard)/travel/page.tsx`
* `frontend/e2e/finance.spec.ts` or another focused E2E test file

Do not edit backend files unless required by a discovered issue directly related to this task.

### Implementation Sequence

1. Inspect the current export button patterns in all affected dashboard pages.
2. Choose the smallest shared helper or local state pattern that keeps the code readable.
3. Add active export state and duplicate-click prevention.
4. Add disabled/busy rendering to each export button.
5. Preserve existing filenames and toast behavior.
6. Add focused Playwright coverage for duplicate-click prevention and busy-state reset.
7. Run the focused validation commands.
8. Commit and push the completed change to `develop`.
9. Update this task document with implementation notes, validation results, commit hash, push status, and `status: implemented`.

### Constraints

* Keep the change narrowly scoped to CSV export button behavior.
* Do not change CSV contents, backend query behavior, or route contracts.
* Do not expose raw backend errors or response details in the UI.
* Do not log CSV contents, tokens, or headers.
* Keep UI consistent with existing dashboard icon-button styling.

## 11. Completion Criteria

* Every existing CSV export button has an in-flight disabled/busy state.
* Rapid repeated clicks on an active export button do not create duplicate export requests.
* Buttons return to idle after success and after failure.
* Existing CSV filenames and endpoints are unchanged.
* Existing success and error toast behavior remains user-safe.
* Focused frontend validation or E2E coverage confirms duplicate-click prevention for at least one export button.
* Claude Code commits and pushes the implementation directly to `develop`.
* This task document is updated to `status: implemented` with commit, push, and validation details.

## 12. PR Review Checklist

* [ ] Export buttons disable only the active export action, not the whole page.
* [ ] Pages with multiple exports track each export independently.
* [ ] Duplicate clicks while active result in a single request.
* [ ] Success and failure both clear the busy state.
* [ ] CSV endpoint paths and filenames remain unchanged.
* [ ] Error feedback remains generic and does not expose internals.
* [ ] No tokens, headers, CSV contents, or secrets are logged.
* [ ] Focused frontend validation covers the new behavior.
