# TASK-092: Legacy Growth and Career AI Read-Only Mode

status: working
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Stop new AI writes to hidden legacy Growth/Career structures while preserving existing records,
authenticated APIs, and exports for compatibility and migration.

## 2. Requirements

- Reject AI create, update, and delete for Growth books, English logs, and Career ratings.
- Apply enforcement to single actions, multi-actions, and confirmed execute requests.
- Preserve direct authenticated legacy APIs and exports.
- Return a clear migration-oriented response without mutating data.

## 3. Current Structure Analysis

- Legacy frontend routes redirect to Trackers, but AI still accepts legacy mutations.
- Existing records need a separate migration/retention decision.

## 4. Design

- Backend: central legacy AI module denylist applied before mutation handlers.
- DB/frontend: No change.
- Security impact: reduces hidden mutation surface and preserves explicit compatibility access.

## 5. Test Plan

- Single create/update, multi-action, and execute-delete rejection.
- Verify legacy data remains present after rejected delete.
- Full focused AI regression suite.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- No AI endpoint can mutate legacy Growth/Career data.
- Direct APIs and exports continue working.
- User receives guidance to use configurable Trackers.

## 8. PR Review Checklist

- Confirm denylist is enforced server-side on every AI mutation path.
- Confirm legacy records are not deleted.
- Confirm current modules remain unaffected.
