# TASK-038: Frontend Lint and React Purity Cleanup

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Restore a clean frontend lint run so CI can catch real regressions and the React code follows the current Next.js/React lint rules.

## 2. Requirements

- In scope:
  - Fix current `npm run lint` failures.
  - Remove or refactor synchronous `setState` calls inside effects that trigger `react-hooks/set-state-in-effect`.
  - Remove render-time impure `Date.now()` usage flagged by `react-hooks/purity`.
  - Fix unescaped text in JSX and unused imports/variables.
  - Keep existing user-facing behavior unchanged.
- Out of scope:
  - Broad frontend redesign.
  - Disabling lint rules to hide real issues.
  - Migrating to a different lint configuration.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Files reviewed: `frontend/app/(dashboard)/career/page.tsx`, `frontend/app/(dashboard)/finance/page.tsx`, `frontend/app/(dashboard)/growth/page.tsx`, `frontend/app/(dashboard)/health/page.tsx`, `frontend/app/(dashboard)/layout.tsx`, `frontend/app/(dashboard)/page.tsx`, `frontend/app/(dashboard)/planner/page.tsx`, `frontend/app/(dashboard)/travel/page.tsx`, `frontend/components/Toast.tsx`, `frontend/lib/api.ts`.
- Current behavior:
  - `npx.cmd tsc --noEmit` passes.
  - `npm.cmd run build` passes.
  - `npm.cmd run lint` fails with 14 errors and 4 warnings.
  - Main error categories are synchronous state updates in effects, render-time `Date.now()`, unescaped quotes, and unused imports.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Move initial date defaults into `useState` initializer functions where possible.
  - Convert effect-driven derived state into render-time derivation or memoized state when appropriate.
  - For load-on-mount effects that call functions which set loading/error state, use a pattern accepted by lint without changing behavior.
  - Replace render-time `Date.now()` with a stable computed value or helper that does not violate purity.
  - Remove unused imports and variables.
  - Fix unescaped JSX text in planner copy.
- Security impact:
  - No direct security behavior change expected.
  - Ensure auth redirect behavior in dashboard layout is preserved.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests:
  - Run `npx.cmd tsc --noEmit`.
  - Run `npm.cmd run lint`.
  - Run `npm.cmd run build`.
  - Smoke-check login/dashboard navigation if touched.
- Security checks:
  - Confirm token expiry redirect logic remains intact.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- `npm.cmd run lint` passes with no errors.
- TypeScript and production build still pass.
- Existing page behavior remains unchanged.
- No lint rules are disabled broadly to bypass the issue.

## 8. PR Review Checklist

- Confirm fixes are behavior-preserving.
- Confirm no new effect loops or duplicate API calls are introduced.
- Confirm auth layout still redirects unauthenticated users.
- Confirm date defaults still use the current date when forms open.
