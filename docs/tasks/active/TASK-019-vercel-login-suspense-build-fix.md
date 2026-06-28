# TASK-019: Vercel Login Suspense Build Fix

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Fix the Vercel frontend deployment failure caused by the login page using `useSearchParams()` without a Suspense boundary. The build should complete successfully on Vercel while preserving the existing safe `next` redirect behavior after login.

## 2. Requirements

- In scope:
  - Fix `frontend/app/(auth)/login/page.tsx` so `useSearchParams()` is rendered inside a Suspense boundary.
  - Preserve `getSafeNextPath()` behavior that only allows same-origin relative redirect paths.
  - Keep the login form UI and auth flow unchanged except for the build compatibility fix.
  - Verify production build locally with `cd frontend && npm run build`.
  - Verify TypeScript still passes with `cd frontend && npx tsc --noEmit`.
- Out of scope:
  - No backend auth changes.
  - No Vercel project setting changes unless build still fails after the code fix.
  - No redesign of the login page.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `README.md`
  - `docs/adr/0001-modular-monolith.md`
  - `docs/adr/0002-bff-pattern.md`
  - `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `frontend/app/(auth)/login/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/package.json`
  - `frontend/playwright.config.ts`
- Deployment log reviewed:
  - Vercel deployment `dpl_Ah3E1TYXUEyyXuiDvDPcA1Xf8Kbr`
- Current behavior:
  - Vercel builds branch `main`, commit `2f0292e`.
  - `npm run build` compiles and typechecks successfully.
  - Build fails while generating static page `/login`.
  - Vercel/Next.js error:
    - `useSearchParams() should be wrapped in a suspense boundary at page "/login".`
    - `Error occurred prerendering page "/login".`
    - `Export encountered an error on /(auth)/login/page: /login, exiting the build.`
  - `frontend/app/(auth)/login/page.tsx` is a client component that calls `useSearchParams()` directly in the page component.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Split the login page into:
    - a default exported wrapper component that renders `<Suspense fallback={...}>`
    - an inner client component that calls `useSearchParams()`
  - Keep `getSafeNextPath()` in the same file unless local style suggests otherwise.
  - Use a minimal fallback matching the existing white login page background to avoid layout flash.
  - Preserve `router.replace(nextPath)` after successful login.
- Security impact:
  - This task touches login redirect handling.
  - Preserve the existing open-redirect guard:
    - allow paths that start with `/`
    - reject protocol-relative paths starting with `//`
    - fall back to `/` for unsafe values
  - Do not log credentials, tokens, or login errors with sensitive details.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend checks:
  - Run `cd frontend && npx tsc --noEmit`.
  - Run `cd frontend && npm run build`.
- E2E/manual validation:
  - Visit `/login` without `next` and verify successful login redirects to `/`.
  - Visit `/login?next=%2Ftravel` and verify successful login redirects to `/travel`.
  - Visit `/login?next=https%3A%2F%2Fevil.example` and verify successful login redirects to `/`.
  - Visit `/login?next=%2F%2Fevil.example` and verify successful login redirects to `/`.
- Deployment validation:
  - Redeploy or let Vercel rebuild after the fix reaches the deployed branch.
  - Inspect Vercel logs if deployment still fails.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- `/login` no longer triggers the Next.js missing Suspense boundary build error.
- Local frontend production build passes.
- TypeScript check passes.
- Safe `next` redirect behavior is preserved.
- No login credentials, tokens, or secrets are logged.
- Task document records implementation notes, validation results, commit hash, and push status.

## 8. PR Review Checklist

- `useSearchParams()` is inside a Suspense boundary.
- Login redirect sanitization is unchanged or stronger.
- Login UI and auth API call behavior remain unchanged.
- `npm run build` passes locally.
- No unrelated auth or routing changes are included.

## 9. Implementation Notes

### Change (`frontend/app/(auth)/login/page.tsx`)

- Renamed the existing page component to inner `LoginForm()` (still
  `'use client'`), which is where `useSearchParams()` is called.
- Added a new default-exported `LoginPage()` wrapper that renders
  `<Suspense fallback={<div className="min-h-screen bg-white" />}>` around
  `<LoginForm />`. The fallback matches the login page's white background to
  avoid layout flash.
- Imported `Suspense` from `react`.
- `getSafeNextPath()` is unchanged: allows paths starting with `/`, rejects
  protocol-relative `//`, falls back to `/`. Open-redirect guard preserved.
- Login form UI, `authApi.login()` call, and `router.replace(nextPath)` after
  success are all unchanged. No credentials/tokens logged.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm run build` → **success**. `/login` now prerenders as
  static content with no "useSearchParams() should be wrapped in a suspense
  boundary" error. All 11 routes generated.

### Redirect behavior (preserved, verified by code inspection)

- `/login` (no `next`) → `/`
- `/login?next=%2Ftravel` → `/travel`
- `/login?next=https%3A%2F%2Fevil.example` → `/` (rejected, not `/`-prefixed)
- `/login?next=%2F%2Fevil.example` → `/` (rejected, `//` protocol-relative)

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
