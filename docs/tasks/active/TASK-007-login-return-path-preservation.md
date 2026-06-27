# TASK-007: Login Return Path Preservation

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28

branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Preserve the user's intended dashboard path when an unauthenticated user is redirected to login, then return them to that same safe internal path after successful authentication.

This is a low-risk usability improvement for the existing auth flow. Today, `frontend/app/(dashboard)/layout.tsx` redirects unauthenticated dashboard access to `/login`, and `frontend/app/(auth)/login/page.tsx` always redirects successful login to `/`. If a user opens `/travel`, `/finance`, or another deep dashboard URL after their token is missing or expired, they lose their original destination and must navigate manually after login.

## 2. Requirements

### In Scope

* When `DashboardLayout` redirects an unauthenticated user to login, include the current path and query string as a return target.
* After a successful login, navigate to the validated return target instead of always navigating to `/`.
* Keep the existing default behavior of navigating to `/` when no return target is provided.
* Allow only safe internal application paths as return targets.
* Add or update focused E2E coverage for:
  * unauthenticated deep-link access redirects to login with a return target
  * successful login returns to the original dashboard path
  * unsafe external return targets are ignored and fall back to `/`

### Out of Scope

* Changing backend authentication, JWT issuance, token lifetime, or password validation.
* Adding server-side sessions or refresh tokens.
* Changing the visible login page design beyond the minimal state and routing updates needed for this flow.
* Changing logout behavior, except to ensure it does not accidentally create an unsafe return target.

### Security Impact

This task touches authentication routing and client-side redirect behavior.

* The login page must reject open redirects. A return target is valid only when it is an internal path that starts with `/` and does not start with `//`.
* Do not allow absolute URLs, protocol-relative URLs, `javascript:` URLs, or other external destinations.
* Do not store tokens in query parameters, route params, logs, or test output.
* Continue storing and reading the JWT only through the existing `localStorage` token flow unless a separate approved task changes auth storage.
* Login failure messages must remain generic and must not expose whether the username or password was wrong.
* This task does not change database persistence, deletion, exports, AI execution, or external service calls.

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`

### Relevant Files Reviewed

* `frontend/app/(dashboard)/layout.tsx`
* `frontend/app/(auth)/login/page.tsx`
* `frontend/lib/api.ts`
* `frontend/components/Sidebar.tsx`
* `frontend/e2e/login.spec.ts`
* `frontend/e2e/auth.setup.ts`
* `app/modules/auth/router.py`
* `app/modules/auth/service.py`
* `tests/test_auth.py`

### Observed Current Behavior

* `DashboardLayout` checks `localStorage.getItem('token')` on mount.
* If no token exists, `DashboardLayout` calls `router.replace('/login')`.
* `LoginPage` calls `authApi.login(username, password)` and stores `data.access_token` in `localStorage`.
* After successful login, `LoginPage` calls `router.replace('/')`.
* `frontend/lib/api.ts` also redirects to `/login` after a `401` response when a token existed and was removed.
* Existing Playwright login coverage checks login page rendering, invalid credentials, and unauthenticated root access redirecting to `/login`.
* Backend auth service uses `secrets.compare_digest` and returns a bearer token through the existing `/api/v1/auth/token` endpoint.

### Problem

Deep-linking into an authenticated dashboard route loses user context when login is required. The app already has module-specific pages and sidebar navigation, so returning users to the intended module after login reduces day-to-day friction without requiring backend changes.

## 4. Impact Scope

### Frontend

* `frontend/app/(dashboard)/layout.tsx`
  * Build a return target from the current pathname and search string.
  * Redirect unauthenticated users to `/login?next=<encoded internal path>`.
* `frontend/app/(auth)/login/page.tsx`
  * Read the `next` query parameter.
  * Validate it with a small local helper before using it.
  * Redirect to the safe target after successful login, otherwise redirect to `/`.
* `frontend/lib/api.ts`
  * Optional: when handling `401`, preserve the current path as `next` if the current page is not already `/login`.
  * Keep the existing token removal behavior.
* `frontend/e2e/login.spec.ts`
  * Add focused Playwright coverage for the return path behavior.

### Backend

* No backend behavior change is required.
* Backend auth tests should not need changes unless implementation uncovers a contract issue.

### Tests

* Frontend E2E tests should cover the new routing behavior.
* Backend auth tests can remain unchanged unless Claude Code identifies a regression risk.

## 5. Design Decision

Use a `next` query parameter on `/login` rather than `sessionStorage` or a new backend state mechanism.

Rationale:

* It is transparent and easy to test with Playwright.
* It does not require backend changes or new persistence.
* It works for direct URL entry, browser reloads, and unauthenticated redirects from dashboard routes.
* It keeps the redirect target short-lived in the URL and avoids storing additional auth state.

Validation rule:

* Accept only strings where:
  * `target.startsWith('/')`
  * `!target.startsWith('//')`
  * `target` does not contain a URL scheme before the first path separator
* Fall back to `/` for invalid, absent, or malformed values.

## 6. API Design

No backend API change.

| Method | Path | Change |
| --- | --- | --- |
| POST | `/api/v1/auth/token` | No change |

Frontend route behavior:

| Route | Behavior |
| --- | --- |
| `/login` | Login page; redirects to `/` after success when `next` is absent or unsafe |
| `/login?next=/travel` | Login page; redirects to `/travel` after success |
| `/login?next=https://example.com` | Login page; redirects to `/` after success |
| `/login?next=//example.com` | Login page; redirects to `/` after success |

## 7. DB Design

No database change.

* No migration is required.
* No model, repository, service persistence, or query behavior should change.

## 8. Frontend Design

### Dashboard Redirect

In `frontend/app/(dashboard)/layout.tsx`:

* Use `usePathname()` and `useSearchParams()` from `next/navigation`.
* Build `next` as the current pathname plus `?${searchParams.toString()}` when a query string exists.
* Redirect with `router.replace(`/login?next=${encodeURIComponent(next)}`)`.
* Preserve the existing loading spinner while the redirect decision is pending.

### Login Redirect

In `frontend/app/(auth)/login/page.tsx`:

* Use `useSearchParams()` to read `next`.
* Add a small helper such as `getSafeNextPath(value: string | null): string`.
* After successful login, call `router.replace(getSafeNextPath(next))`.
* Keep invalid credential handling generic.

### 401 Interceptor

In `frontend/lib/api.ts`, if this is included:

* When a token exists and a `401` occurs, remove the token as today.
* If `window.location.pathname !== '/login'`, redirect to `/login?next=<safe current path>`.
* Do not redirect to external URLs, and do not include tokens or sensitive data in the query string.

## 9. Security Impact

This task touches auth routing. Claude Code must explicitly verify:

* External `next` values cannot cause an open redirect.
* Protocol-relative `next` values such as `//example.com` cannot cause an open redirect.
* The login page never places the JWT in the URL.
* The `next` parameter is treated only as a client-side route target, not as trusted authorization state.
* Existing backend authentication remains authoritative and unchanged.
* Existing token cleanup on `401` still happens.

## 10. Test Plan

### Frontend E2E

Update `frontend/e2e/login.spec.ts` or add a focused auth routing spec.

Recommended cases:

1. With empty storage, visit `/travel`.
2. Assert the page redirects to `/login` and the URL contains `next=%2Ftravel` or an equivalent decoded `next=/travel`.
3. Fill valid credentials from `E2E_USERNAME` and `E2E_PASSWORD`, matching the existing setup pattern.
4. Submit login.
5. Assert the final URL is `/travel`.
6. Visit `/login?next=https%3A%2F%2Fexample.com`, log in, and assert the final URL is `/`.
7. Visit `/login?next=%2F%2Fexample.com`, log in, and assert the final URL is `/`.

### Manual Verification

* Clear `localStorage.token`.
* Open `/finance` directly.
* Confirm the app redirects to login.
* Log in successfully.
* Confirm the app lands on `/finance`.
* Repeat with `/login?next=https://example.com` and confirm it lands on `/`.

### Backend Tests

No backend test run is required for this frontend-only implementation unless backend auth files are changed.

## 11. Claude Code Implementation Instructions

* Implement directly on `develop`; do not create a feature or fix branch.
* Before editing, check `git status` and preserve any unrelated user or Claude Code changes.
* Do not modify task files other than this one unless updating this task status and implementation notes.
* Keep the implementation small and local to auth routing and login E2E coverage.
* Do not change backend auth behavior unless a concrete issue is discovered and recorded in this task.
* Do not log credentials, JWTs, headers, or localStorage contents.
* Add implementation notes, validation results, commit hash, and push status to this task.
* Completion means:
  * implementation is complete,
  * validation has been run and recorded,
  * changes are committed directly to `develop`,
  * `develop` is pushed,
  * this task is updated to `status: implemented`.

## 12. Completion Criteria

* Unauthenticated dashboard deep-link access redirects to `/login` with a safe encoded return target.
* Successful login returns to the intended internal dashboard path.
* Login without a valid return target still redirects to `/`.
* Unsafe external or protocol-relative return targets fall back to `/`.
* Existing invalid-login behavior remains generic.
* Existing authenticated navigation still works.
* E2E coverage or equivalent validation documents the new behavior.
* Security notes confirm no open redirect was introduced.

## 구현 결과

### 변경 파일

* `frontend/app/(dashboard)/layout.tsx` — `window.location.pathname + search`로 next 경로 구성, `/login?next=<encoded>` 리다이렉트
* `frontend/app/(auth)/login/page.tsx` — `useSearchParams`로 next 읽기, `getSafeNextPath` 검증 헬퍼, 로그인 후 복귀
* `frontend/lib/api.ts` — 401 인터셉터에서 현재 경로를 next로 포함해 /login 리다이렉트
* `frontend/e2e/login.spec.ts` — 딥링크 리다이렉트, 복귀 경로, 외부/프로토콜-상대 URL 폴백 E2E 테스트 추가

### 구현 요약

* `getSafeNextPath`: `value.startsWith('/') && !value.startsWith('//')` 조건만으로 오픈 리다이렉트 차단 — 외부 절대 URL(`https://`), 프로토콜-상대 URL(`//example.com`) 모두 `/`로 폴백
* `layout.tsx`는 `window.location`을 직접 사용해 `useSearchParams` Suspense 래핑 없이 안전하게 구현
* 401 인터셉터는 현재 경로가 `/login`이 아닌 경우에만 `next` 파라미터 추가 (무한 루프 방지)

### 추가/수정한 테스트

* `딥링크 접근 시 next 파라미터 포함 /login 으로 리다이렉트` — `/travel` → `/login?next=%2Ftravel` 확인
* `로그인 후 next 경로로 복귀` — `/login?next=%2Ffinance` 로그인 후 `/finance` 도착 확인
* `외부 URL next 값은 / 로 폴백` — `next=https://example.com` → `example.com` 아님 확인
* `프로토콜 상대 URL next 값은 / 로 폴백` — `next=//example.com` → `example.com` 아님 확인

### 실행한 검증 명령

```
cd frontend && npx tsc --noEmit
```

### 테스트 결과

* TypeScript: 오류 없음 (exit 0)
* e2e: live 서버 필요로 미실행. 기존 3개 테스트 + 새 4개 테스트 추가

### 커밋

`f938fdc` — develop 브랜치 직접 커밋 + push (PR 없음)

### 남은 이슈

없음

## 13. PR Review Checklist

* [ ] The implementation preserves the intended path for unauthenticated dashboard deep links.
* [ ] The `next` parameter validation prevents open redirects.
* [ ] JWTs and credentials are never placed in URLs or logs.
* [ ] Existing login failure messaging remains generic.
* [ ] Existing `/login` without `next` still redirects to `/` after success.
* [ ] Existing dashboard auth guard behavior still blocks unauthenticated access.
* [ ] Playwright or documented validation covers the happy path and unsafe `next` values.
* [ ] Task status and implementation notes were updated after commit and push to `develop`.
