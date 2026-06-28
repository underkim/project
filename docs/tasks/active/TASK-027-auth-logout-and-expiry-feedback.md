# TASK-027: Auth Logout and Expiry Feedback

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make logout and session-expiry transitions clearer. Users should understand when they were redirected because the token expired versus when they intentionally logged out.

## 2. Requirements

- In scope:
  - Add a safe login-page message for expired sessions or intentional logout.
  - Preserve existing `next` redirect behavior for 401 redirects.
  - Keep logout clearing token and AI chat history.
  - Avoid showing messages on normal first login visits.
  - Keep open-redirect protection intact.
- Out of scope:
  - No backend auth token changes.
  - No refresh-token implementation.
  - No login page redesign.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/lib/api.ts`, `frontend/app/(auth)/login/page.tsx`, `frontend/components/Sidebar.tsx`
- Current behavior:
  - The axios interceptor removes token and redirects to `/login?next=...` on `401` when a token exists.
  - Sidebar logout removes token and AI chat history, then routes to `/login`.
  - Login page has safe `next` path handling.
  - Users do not get a clear reason for being sent back to login.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Add a safe query parameter such as `reason=expired` for interceptor redirects and `reason=logout` for intentional logout.
  - Render a small non-error informational message on login for known reason values.
  - Keep unknown reason values ignored.
  - Preserve Suspense structure from the Vercel login build fix.
- Security impact:
  - This task touches login redirects.
  - Preserve existing `next` sanitization and reject external/protocol-relative redirects.
  - Do not expose token contents or raw auth errors.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/manual tests:
  - Trigger logout and verify login shows a logout confirmation message.
  - Simulate a 401 with an existing token and verify login shows a session-expired message with `next` preserved.
  - Verify unsafe `next` values still redirect to `/`.
  - Verify normal `/login` shows no reason message.
- Security checks:
  - Unknown query parameters are ignored.
  - No token values are logged or displayed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Logout and expired-session login states are distinguishable.
- Safe `next` redirect behavior is preserved.
- Unknown reason values do not render arbitrary text.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Redirect URL construction remains safe.
- Reason messages are fixed strings, not reflected raw query values.
- Existing login flow is unchanged otherwise.
- No backend auth behavior changed.

## 9. Implementation Notes

### Changes

1. **`frontend/lib/api.ts` (401 interceptor)** — builds the redirect URL with
   `URLSearchParams`, setting `next` (only when not already on `/login`) and
   `reason=expired`. Token is still removed first. Result e.g.
   `/login?next=%2Ftravel&reason=expired`.
2. **`frontend/components/Sidebar.tsx` (logout)** — now routes to
   `/login?reason=logout`. Token and `ai-chat-history` removal unchanged.
3. **`frontend/app/(auth)/login/page.tsx`** — added a `REASON_MESSAGES` map for
   the two known reasons (`expired`, `logout`) and renders the **fixed** string
   in a small non-error `role="status"` info box above the form. Unknown/absent
   `reason` values render nothing (the raw query value is never reflected into
   the DOM). `getSafeNextPath` open-redirect guard and the Suspense wrapper from
   TASK-019 are untouched.

### Security

- Reason text is a fixed lookup, not the raw query param — no reflected-XSS
  surface. Unknown `reason` → no message.
- `next` sanitization unchanged: only same-origin `/`-prefixed paths accepted;
  `//` and external URLs fall back to `/`.
- No token contents or raw auth errors are displayed or logged.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm run build` → success, `/login` still prerenders static
  (Suspense boundary intact). No backend change.
- Manual: logout → "로그아웃되었습니다."; 401 with token → "세션이 만료되어 다시
  로그인이 필요합니다." with `next` preserved; bare `/login` → no message;
  `?reason=<unknown>` → no message; unsafe `next` still lands on `/`.

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
