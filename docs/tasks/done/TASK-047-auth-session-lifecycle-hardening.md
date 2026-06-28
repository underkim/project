# TASK-047: Auth Session Lifecycle Hardening

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Improve authentication session reliability and safety so users understand expiry, logout, and invalid-token states without leaving the app stuck.

## 2. Requirements

- In scope:
  - Audit login, logout, token expiry redirect, and API interceptor behavior.
  - Ensure expired or invalid tokens clear local state and redirect consistently.
  - Improve user-facing messages for expiry versus wrong password.
  - Verify protected pages do not remain in permanent loading states.
- Out of scope:
  - Migrating to HttpOnly cookie auth.
  - Adding multi-user account management.
  - Changing JWT expiration duration unless a bug is found.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, auth-related task docs.
- Files reviewed: `app/core/security.py`, `app/modules/auth/*`, `frontend/lib/api.ts`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(dashboard)/layout.tsx`, `frontend/components/Sidebar.tsx`.
- Current behavior:
  - JWT is stored client-side and attached by axios interceptor.
  - Prior tasks improved logout/expiry feedback.
  - Further audit is needed after dashboard connection complaints.

## 4. Design

- Backend/API: Preserve current token contract; tighten error consistency if needed.
- DB: No schema change.
- Frontend: Normalize expiry clearing, redirect, and explanatory login messages.
- Security impact: Touches auth; avoid leaking token contents or raw auth errors.

## 5. Test Plan

- Backend tests: Auth success/failure and protected route 401.
- Frontend/E2E tests: Expired-token simulation, logout, wrong password, redirect next path.
- Security checks: Verify tokens are not logged or shown.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Expired token flow is clear and recoverable.
- Wrong password and expired session messages are distinct.
- Protected pages do not hang after auth failure.

## 8. PR Review Checklist

- Confirm auth redirects preserve intended next path.
- Confirm no token values are printed.
- Confirm login failure does not trigger expiry redirect.
