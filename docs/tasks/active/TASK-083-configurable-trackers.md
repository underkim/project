# TASK-083: Configurable Trackers

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: feature

## 1. Goal

Replace fixed Growth and Career entry points with an approachable configurable tracker where anyone
can define what they want to measure and record dated values without technical setup.

## 2. Requirements

- Users can create, edit, archive, and delete tracker definitions.
- Each tracker has a name, optional description/unit, color, and number/text/checkbox value type.
- Users can create, edit, and delete dated entries with an optional note.
- Provide friendly starter examples and empty states without silently creating user data.
- Show active tracker counts and recent activity on the dashboard.
- Keep legacy Growth/Career APIs and tables temporarily for data preservation, but remove them from
  primary navigation.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, ADR-0001, ADR-0002, ADR-0003.
- Files reviewed: Finance/Growth/Career module patterns, dashboard service/schema, frontend API/types,
  dashboard pages, Sidebar, and test fixtures.
- Existing Growth and Career models are domain-specific and cannot represent arbitrary user choices.

## 4. Design

- Backend/API: add `trackers` modular domain with definition and entry CRUD plus summary.
- DB: add `trackers` and `tracker_entries`; entries cascade on tracker deletion; enable PostgreSQL RLS.
- Frontend: add `/trackers` with guided tracker creation, type-aware entry input, recent history, and
  clear empty/loading/error states. Replace Growth/Career sidebar links with Trackers.
- Security impact: validate lengths, enum values, colors, dates, finite numeric values, and ownership
  assumptions; use ORM-bound queries; never return raw internal exceptions.

## 5. Test Plan

- Backend tests: authenticated CRUD, cascade, validation, 404, pagination, archive, and summary.
- Frontend/E2E tests: typecheck/build; tracker creation, selection, recording, editing, deletion, and
  empty states.
- Security checks: authentication, bounded strings, invalid value/type combinations, and safe errors.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Tracker and entry CRUD work end to end.
- Input adapts to number, text, and checkbox trackers.
- Dashboard shows useful tracker summary data.
- Growth/Career are no longer primary navigation items.
- Existing Growth/Career data remains untouched.
- Backend tests and frontend validation pass.

## 8. PR Review Checklist

- Confirm the module boundary and explicit relationship loading.
- Confirm deletion and archive behavior are understandable.
- Confirm invalid typed values cannot be stored.
- Confirm dashboard partial failure behavior remains intact.
- Confirm old records are preserved.

## 9. Implementation Result

- Added configurable number, text, and checkbox trackers with dated entry CRUD, archive, delete,
  dashboard summary, validation, migration, and a guided responsive page.
- Legacy Growth/Career data remains untouched; their old frontend paths redirect to Trackers.
- Implementation commit: `efaad30` plus the final status/usability follow-up commit.
- Validation: 393 backend tests, 24 focused tests, frontend lint, typecheck, and production build passed.
