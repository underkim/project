# TASK-084: Tracker Onboarding and Archive Management

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make configurable trackers immediately understandable for first-time users and ensure archived
trackers can be reviewed, restored, or permanently deleted without technical knowledge.

## 2. Requirements

- Offer optional starter templates for common health, learning, mood, and habit workflows.
- Templates must remain editable and must not create data without a user click.
- Add an archive view with restore and permanent-delete actions.
- Keep custom tracker creation as the primary flexible path.
- Preserve all existing entries during archive and restore.

## 3. Current Structure Analysis

- Files reviewed: `frontend/app/(dashboard)/trackers/page.tsx`, `frontend/lib/api.ts`, Tracker API.
- Backend already supports `include_archived` and `is_archived` updates.
- The current empty state explains custom creation but provides no examples or archive recovery UI.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: add four one-click starter templates and an active/archive view toggle; reuse existing
  create/update/delete endpoints.
- Security impact: templates use static application-owned values; all server validation remains active;
  destructive deletion retains explicit confirmation.

## 5. Test Plan

- Backend tests: existing Tracker archive and CRUD tests.
- Frontend/E2E tests: lint, typecheck, production build, template creation, archive filtering, restore.
- Security checks: no silent data creation and no bypass of server validation.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- A first-time user can start from a template or create a custom tracker.
- Archived trackers are discoverable and restorable.
- Permanent deletion remains clearly destructive.
- Empty states explain both active and archived views.
- Frontend validation passes.

## 8. PR Review Checklist

- Confirm templates remain optional.
- Confirm archived entries are preserved.
- Confirm restore returns the tracker to the active list.
- Confirm deletion confirmation names the affected tracker.

## 9. Implementation Result

- Added optional health, learning, mood, and habit starter templates.
- Added active/archive counts, archived-item discovery, restore, and permanent deletion.
- Archived trackers retain entries and are read-only until restored.
- Implementation commit: `95de1ba`.
- Validation: frontend lint, typecheck, and production build passed.
