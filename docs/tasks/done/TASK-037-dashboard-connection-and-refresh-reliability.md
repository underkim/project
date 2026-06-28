# TASK-037: Dashboard Connection and Refresh Reliability

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Make the dashboard reliably reflect module data changes and clearly explain connection or partial-load failures so the user can trust the overview page.

## 2. Requirements

- In scope:
  - Audit dashboard frontend refresh behavior after module mutations and AI saves.
  - Confirm dashboard API connectivity, auth expiry handling, retry behavior, and partial-failure display.
  - Ensure dashboard cards do not silently show stale values after data is added, changed, or deleted in module pages.
  - Add user-visible recovery actions for failed dashboard loads.
  - Improve backend dashboard failure diagnostics without exposing raw exception details to users.
- Out of scope:
  - Redesigning the dashboard layout.
  - Adding new dashboard widgets unrelated to existing module summaries.
  - Changing module business logic unless required to fix dashboard summary correctness.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`.
- Files reviewed: `app/modules/dashboard/service.py`, `app/modules/dashboard/schemas.py`, `frontend/app/(dashboard)/page.tsx`, `frontend/lib/api.ts`, `frontend/hooks/useAiRefresh.ts`, `tests/test_dashboard.py`.
- Current behavior:
  - `GET /api/v1/dashboard/overview` aggregates planner, finance, health, growth, career, and travel snapshots.
  - Backend partial failures return `null` module data with `meta.partial_failure`.
  - Frontend dashboard loads once on mount and uses `useAiRefresh([], load)`.
  - Local goal changes refresh only local goal state, not the dashboard API.
  - The user reports that dashboard connection does not feel reliable.

## 4. Design

- Backend/API:
  - Preserve the read-only BFF pattern.
  - Add structured logging context for failed module snapshots: module name and sanitized error type.
  - Confirm each module snapshot catches expected exceptions and does not hide systemic session/concurrency issues.
  - Verify dashboard aggregation does not trigger async lazy-loading errors after recent travel map and restaurant changes.
  - Do not expose raw backend exceptions in API responses.
- DB:
  - No schema change expected.
- Frontend:
  - Make dashboard reload behavior explicit after module data changes, including AI save events.
  - Verify `useAiRefresh` dependencies include dashboard-relevant modules or intentionally listen to all modules.
  - Add a visible last-updated or retry state when dashboard data is refreshed.
  - Improve failed-load and partial-failure UI copy so the user knows whether the whole dashboard failed or only some modules failed.
  - Ensure auth expiry redirects do not leave the dashboard in a permanent loading state.
- Security impact:
  - This task touches authenticated dashboard API behavior and error display.
  - Do not show raw exception text, stack traces, DB details, secrets, or provider errors.
  - Keep dashboard read-only and do not introduce writes from dashboard refresh logic.

## 5. Test Plan

- Backend tests:
  - Add or update `tests/test_dashboard.py` for partial module failure reporting.
  - Verify travel snapshot works with trip restaurants and map fields.
  - Verify dashboard response never exposes raw exception text.
- Frontend/E2E tests:
  - Verify dashboard loads successfully after login.
  - Verify retry action can recover after a failed overview call.
  - Verify dashboard refreshes after an AI data-saved event for at least one module.
  - Verify partial-failure banner shows the affected module name and leaves other cards usable.
- Security checks:
  - Verify failed module details are sanitized.
  - Verify unauthenticated dashboard requests still return 401.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Dashboard reliably loads overview data after login.
- Dashboard refreshes when relevant module data changes through AI save events.
- Full-load failures show a retry path.
- Partial failures identify affected modules without hiding healthy module cards.
- Backend logs contain enough sanitized context to diagnose failed dashboard modules.
- Tests cover dashboard refresh or failure behavior.

## 8. PR Review Checklist

- Confirm dashboard remains read-only.
- Confirm no raw backend details are exposed to users.
- Confirm recent travel restaurant/map data does not break the travel dashboard snapshot.
- Confirm retry and refresh states do not cause duplicate requests or permanent spinners.
- Confirm auth expiry still redirects correctly.
