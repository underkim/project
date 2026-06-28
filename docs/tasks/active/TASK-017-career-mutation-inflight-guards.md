# TASK-017: Career Mutation In-Flight Guards

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Prevent duplicate career settings and Codeforces rating mutations by adding scoped pending states to the career page. Users should get clear feedback while saves, edits, deletes, and load-more requests are running.

## 2. Requirements

- In scope:
  - Add in-flight guards for career settings save, rating create, rating update, rating delete, goal save, and load-more actions.
  - Disable only the relevant controls while their action is pending.
  - Show inline spinner or existing `Loader2` where appropriate for long-running actions.
  - Prevent duplicate submit/delete clicks from sending repeated requests.
  - Keep current external link validation behavior intact.
- Out of scope:
  - No new career features.
  - No DB schema changes.
  - No redesign of chart or summary cards.
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
  - `frontend/app/(dashboard)/career/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
  - `app/modules/career/router.py`
  - `app/modules/career/service.py`
  - `tests/test_career.py`
- Current behavior:
  - Career page imports `Loader2`, but mutation pending feedback is limited.
  - Settings save, rating create, rating update, and rating delete can be triggered repeatedly before the first request finishes.
  - Delete confirmation buttons do not receive disabled state.
  - Load-more has its own pending state.
  - Local Codeforces goal save is synchronous but can still be made clearer and should allow intentional clearing if existing patterns support it.

## 4. Design

- Backend/API: No change expected.
- DB: No change.
- Frontend:
  - Add a scoped mutation state, such as a `Set<string>`, for career actions.
  - Guard each mutation handler so repeated clicks while pending return early.
  - Disable settings form controls only while settings save is pending.
  - Disable the specific rating row edit/delete controls while that rating action is pending.
  - Keep `handleLoadMore` behavior but make sure it also ignores repeated clicks while pending.
  - Preserve existing toast messages and make failure messages safe and consistent.
- Security impact:
  - This task touches external profile inputs and deletion/update flows.
  - Preserve existing URL normalization and validation from the career page/API.
  - Do not show raw server exception details in toasts.
  - Do not weaken auth, authorization, or deletion behavior.

## 5. Test Plan

- Backend tests: No backend change; run `tests/test_career.py` if API behavior is touched.
- Frontend/E2E tests:
  - Rapidly click settings save and verify only one request is active.
  - Rapidly submit a rating and verify duplicate records are not created by repeated clicks.
  - Rapidly click delete confirmation and verify only one delete request is active.
  - Verify load-more ignores repeated clicks while pending.
  - Verify external profile links and validation still behave as before.
- Security checks:
  - Error toasts are generic or sanitized.
  - External link normalization still blocks unsafe protocols.
  - Delete confirmation remains explicit.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Career mutation handlers have in-flight guards.
- Relevant controls are disabled or show pending feedback during active requests.
- Duplicate save/create/update/delete requests are prevented.
- Existing career tests remain passing if touched.
- Existing external link validation remains intact.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Pending state is scoped to the active action, not the whole page.
- Delete confirmation cannot be double-submitted.
- URL validation behavior is unchanged.
- Error messages do not expose raw internal details.
- No unrelated career page redesign was included.
