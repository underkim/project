# TASK-041: Module List Pagination and Empty State Consistency

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make list-heavy module pages feel consistent and reliable by standardizing pagination, empty states, and refresh behavior across Finance, Health, Growth, Career, and Travel.

## 2. Requirements

- In scope:
  - Audit module list pages for inconsistent limits, offsets, empty states, and loading states.
  - Add missing empty-state copy and recovery actions where records are absent.
  - Ensure pagination or "show more" behavior is predictable where data can grow.
  - Preserve existing API contracts unless a small compatible addition is needed.
- Out of scope:
  - Redesigning module pages.
  - Adding cross-module search.
  - Changing dashboard summary semantics.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, ADRs 0001-0003.
- Files reviewed: relevant module routers/services, `frontend/lib/api.ts`, module pages under `frontend/app/(dashboard)/`.
- Current behavior:
  - Some modules expose limit/offset list calls while others rely on full lists.
  - Empty and loading states vary by page.
  - Growing data can make repeated workflows harder to scan.

## 4. Design

- Backend/API: Add compatible limit/offset support only where needed and safe.
- DB: No schema change expected.
- Frontend: Standardize empty/loading/error/list continuation patterns using existing visual style.
- Security impact: Keep list endpoints authenticated and avoid exposing raw errors.

## 5. Test Plan

- Backend tests: Cover any new list parameters and bounds.
- Frontend/E2E tests: Verify empty state and loaded state for touched pages.
- Security checks: Verify unauthenticated access remains 401.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- List pages have consistent empty/loading/error behavior.
- Large lists have a predictable continuation strategy.
- No existing dashboard or export behavior regresses.

## 8. PR Review Checklist

- Confirm list parameter defaults are backward compatible.
- Confirm empty states are helpful and not noisy.
- Confirm touched endpoints remain authenticated.
