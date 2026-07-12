# TASK-082: Remove Dev Status from Product

status: approved
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Remove the repository-development dashboard from the customer-facing product so release builds contain
only user-oriented Life Dashboard functionality.

## 2. Requirements

- Remove the frontend route, navigation item, API client, and public types.
- Remove backend router registration, settings flag, module code, and tests.
- Remove the standalone desktop dev-status tool.
- Update harness documentation and agent workflow references that claim the product exposes Dev Status.
- Preserve task documents and normal repository planning workflow.

## 3. Current Structure Analysis

- Files reviewed: `app/main.py`, `app/core/config.py`, `app/modules/devstatus/`,
  `frontend/app/(dashboard)/devstatus/`, `frontend/components/Sidebar.tsx`, `frontend/lib/api.ts`,
  `frontend/types/index.ts`, `tests/test_devstatus.py`, `tools/devstatus-desktop/`.
- Dev Status reads repository files and is unrelated to end-user life management.

## 4. Design

- Backend/API: remove `/api/v1/devstatus/*` and its configuration flag.
- DB: No change.
- Frontend: remove the route and all navigation/client references.
- Security impact: removal reduces exposure of repository task metadata and file-derived status.

## 5. Test Plan

- Backend tests: full suite; confirm deleted routes are absent.
- Frontend/E2E tests: typecheck/build and update navigation expectations.
- Security checks: confirm no shipped endpoint returns repository task or activity data.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- No backend or frontend Dev Status route remains.
- No user navigation or API/type reference remains.
- The standalone tool is removed.
- Documentation no longer advertises the feature.
- Validation passes.

## 8. PR Review Checklist

- Search the repository for remaining runtime references.
- Confirm no user feature depends on activity-log files.
- Confirm unrelated task documents remain intact.
