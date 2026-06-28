# TASK-009: Growth Mutation In-Flight Guards

status: done
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal
Prevent duplicate growth records and ambiguous save behavior by adding explicit in-flight guards and visible pending states to the existing book and English-study mutations on the growth page.

Today, `frontend/app/(dashboard)/growth/page.tsx` allows repeated clicks while create, edit, status-change, and delete requests are still running. Because the growth backend does not deduplicate these writes, quick repeated clicks can create duplicate book or English-study records or send overlapping updates that leave the final UI state unclear. This is a concrete usability and correctness improvement for an existing workflow, and it does not require product decisions.

## 2. Requirements
- In scope:
  - Disable repeated submission of book-create and English-create forms while the request is pending.
  - Disable repeated save clicks for inline book and English edits while the request is pending.
  - Disable repeated status changes and delete confirmations for books and English logs while the request is pending.
  - Show a clear pending affordance using existing UI patterns such as disabled buttons and a small spinner or loading label.
  - Keep existing success and error toast behavior.
  - Preserve unsaved form input when a request fails.
  - Add focused frontend coverage or E2E validation for duplicate-click prevention on the growth page.
- Out of scope:
  - Adding backend idempotency keys or database uniqueness constraints.
  - Redesigning the growth page layout or filters.
  - Changing growth summary calculations or response payloads.
  - Refactoring other modules to share a generic mutation hook.

## 3. Current Structure Analysis
- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/app/(dashboard)/growth/page.tsx`, `frontend/lib/api.ts`, `frontend/e2e/finance.spec.ts`, `frontend/e2e/health.spec.ts`, `app/modules/growth/router.py`, `app/modules/growth/service.py`, `app/modules/growth/schemas.py`, `tests/test_growth.py`
- Current behavior:
  - `submitBook()` and `submitEng()` do not track pending state and their submit buttons remain clickable during the request.
  - `saveBookEdit()`, `saveEngEdit()`, `updateBookStatus()`, `deleteBook()`, and `deleteEnglish()` also allow repeated clicks before the first request resolves.
  - `export` actions already have per-action in-flight guards via the local `exporting` `Set`, so the page already has a pattern worth mirroring.
  - Growth create endpoints accept valid repeated payloads and intentionally create separate records, so fast repeated clicks can persist duplicates.
  - Existing backend tests focus on validation and summary correctness, not client-side duplicate-submit behavior.

## 4. Design
- Backend/API: No change.
- DB: No change.
- Frontend:
  - Introduce per-mutation pending state in `frontend/app/(dashboard)/growth/page.tsx`.
  - Use distinct pending keys so book create, English create, inline edit save, status change, and delete confirmation can be guarded independently without freezing the whole page.
  - Reuse the existing visual language from finance, health, travel, and export actions: disabled buttons, reduced opacity, and compact spinner/loading text where useful.
  - Keep the current mutation flow structure and toast messages; this task should not broaden into a shared abstraction.
- Security impact:
  - This task touches authenticated persistence from the frontend, so Claude Code must ensure duplicate-click prevention does not weaken auth checks or bypass existing API validation.
  - Do not store mutation payloads, auth headers, or tokens in URLs, logs, or DOM-visible debug output.
  - Error handling must continue to surface user-safe messages only; do not expose stack traces or internal exception details.
  - Because the backend remains authoritative, disabled UI controls are a usability guard, not a substitute for server-side validation.

## 5. Test Plan
- Backend tests: No backend change.
- Frontend/E2E tests:
  - Add `frontend/e2e/growth.spec.ts` or extend it if Claude Code prefers to create it fresh.
  - Add a delayed-route test for `POST /api/v1/growth/books` that double-clicks the submit button and asserts only one request is sent while the button becomes disabled.
  - Add a delayed-route test for `POST /api/v1/growth/english` with the same duplicate-click assertion.
  - If practical within the existing E2E style, add one focused case for repeated status-change or delete-confirm clicks sending only one request.
- Manual validation:
  - Open `/growth`, start a book create, click save rapidly, confirm only one new book appears.
  - Repeat for English-study create.
  - Trigger a failing create or edit and confirm typed values remain in place after the error toast.
- Security checks:
  - Confirm no token or payload data is added to URLs during pending/error flows.
  - Confirm duplicate-click prevention is UI-only and does not alter API auth requirements.

## 6. Claude Code Instructions
- Work directly on `develop`.
- Preserve unrelated changes already present in the worktree.
- Implement only this task.
- Keep the change local to growth-page mutation state and focused E2E coverage.
- Prefer small explicit state over a broad custom hook unless an existing repo pattern already matches.
- Commit and push to `develop`, then update status to `implemented`.

## 7. Completion Criteria
- Book create cannot be submitted multiple times while a request is pending.
- English-study create cannot be submitted multiple times while a request is pending.
- Inline book and English edit saves are guarded against repeated clicks.
- Book status changes and delete confirmations are guarded against overlapping duplicate requests.
- Pending controls are visibly disabled so the user can tell work is in progress.
- Failed mutations keep the user's unsaved input intact.
- Focused frontend validation covers at least the book-create and English-create duplicate-click cases.

## 구현 결과

### 변경 파일
* `frontend/app/(dashboard)/growth/page.tsx`
  * `mutating: Set<string>` state + `withMutation(key, fn)` 헬퍼 추가
  * `submitBook`, `submitEng`, `saveBookEdit`, `saveEngEdit`, `updateBookStatus`, `deleteBook`, `deleteEnglish` 모두 `withMutation`으로 래핑
  * `DeleteConfirm` 컴포넌트에 `disabled` prop 추가
  * 생성 submit 버튼: `disabled` + `Loader2` 스피너; 편집 저장 버튼: `disabled` + 스피너; 상태 select: `disabled`; DeleteConfirm: `disabled` 전달
* `frontend/e2e/growth.spec.ts` — book/english 생성 중복 클릭 방지 Playwright 테스트 (신규)

### 구현 요약
* `withMutation(key, fn)`: `mutating.has(key)`이면 즉시 return(중복 클릭 무시), Set에 key 추가 → `await fn()` → finally에서 제거
* 각 뮤테이션 키: `book_create`, `eng_create`, `book_edit`, `eng_edit`, `book_status_<id>`, `book_delete_<id>`, `eng_delete_<id>`
* 실패 시 form 입력값은 보존(clearForm은 성공 시에만 실행)
* `exporting` Set 패턴과 동일 방식으로 일관성 유지

### 테스트 결과
* TypeScript: 오류 없음 (exit 0)
* E2E: live 서버 필요로 미실행. 400ms 지연 인터셉트 + requestCount=1 검증 2케이스 추가

### 커밋
`7342e29` — develop 직접 커밋 + push (PR 없음)

## 8. PR Review Checklist
- [ ] Growth create forms disable repeated submission during in-flight requests.
- [ ] Inline edit and delete/status mutations do not send overlapping duplicate requests from repeated clicks.
- [ ] Pending UI is visible and consistent with existing dashboard patterns.
- [ ] Existing success/error toast behavior still works.
- [ ] Failed requests preserve unsaved input where expected.
- [ ] No backend API shape, DB schema, or unrelated module behavior changed.
- [ ] Security review confirms no auth leakage or internal error exposure was introduced.
