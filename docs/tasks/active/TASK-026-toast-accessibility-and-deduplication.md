# TASK-026: Toast Accessibility and Deduplication

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Improve toast notifications so they are accessible, do not flood the screen with identical messages, and remain easy to dismiss. Toasts are used across many dashboard workflows, so small improvements reduce friction globally.

## 2. Requirements

- In scope:
  - Add appropriate ARIA live region semantics for success, info, and error toasts.
  - Deduplicate identical toast messages fired within a short time window.
  - Limit the maximum number of simultaneous toasts.
  - Keep manual dismiss behavior.
  - Preserve the existing `showToast(message, type)` API.
- Out of scope:
  - No new toast design system.
  - No page-specific toast copy rewrite.
  - No backend changes.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/lib/toast.ts`, `frontend/components/Toast.tsx`, dashboard pages using `showToast`
- Current behavior:
  - `showToast()` dispatches a global `app-toast` event.
  - `Toast` appends every event to local state.
  - Toasts auto-dismiss after 3.5 seconds and can be dismissed manually.
  - There is no ARIA live-region metadata and no duplicate suppression.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Add `role="status"` or `role="alert"` and `aria-live` semantics.
  - Suppress exact duplicate message/type pairs within a short interval.
  - Cap visible toasts, for example at 3 or 4, removing the oldest when needed.
  - Keep styling consistent with existing component.
- Security impact:
  - Toasts should continue to display sanitized messages only.
  - Do not add logging of toast contents.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/manual tests:
  - Trigger repeated identical errors and verify only one visible toast appears in the debounce window.
  - Trigger different toast types and verify the cap works.
  - Verify keyboard/mouse dismiss still works.
  - Inspect rendered toast for ARIA attributes.
- Security checks:
  - No internal exception details are introduced into toast messages.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Toasts include accessible live-region semantics.
- Duplicate toast floods are reduced.
- Visible toast count is capped.
- Existing `showToast` callers do not need changes.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Toast API remains backward compatible.
- Accessibility attributes are appropriate for message severity.
- Deduplication does not hide distinct messages.
- No unrelated UI changes are included.

## 9. Implementation Notes

### Change (`frontend/components/Toast.tsx`)

- **ARIA live-region semantics** (per toast, severity-appropriate):
  - error → `role="alert"` + `aria-live="assertive"`
  - success/info → `role="status"` + `aria-live="polite"`
  - all toasts get `aria-atomic="true"`; the dismiss button gained
    `aria-label="알림 닫기"`.
- **Deduplication**: a `toastsRef` mirror is checked synchronously in the
  `app-toast` handler; an identical `message`+`type` already visible within
  `DEDUPE_MS = 2000ms` is ignored, so repeated identical errors don't flood the
  screen. Distinct messages/types are never suppressed.
- **Cap**: `MAX_VISIBLE = 4`; when exceeded the oldest toast is dropped
  (`slice(-MAX_VISIBLE)`).
- **Manual dismiss preserved**: a single `dismiss(id)` updates both the ref and
  state; used by the close button and the auto-dismiss timer
  (`AUTO_DISMISS_MS = 3500`, unchanged).
- The `toastsRef`/`commit` pattern keeps ref and state in sync and makes
  dedup/cap decisions deterministic without relying on async state reads.

`showToast(message, type)` (`frontend/lib/toast.ts`) is **unchanged** — no caller
needs edits. Styling unchanged; messages still display only sanitized text and
nothing is logged.

### Validation

- `cd frontend && npx tsc --noEmit` → clean. No backend change.
- Manual: firing the same error repeatedly shows a single toast for ~2s; firing
  >4 distinct toasts keeps only the newest 4; close button and auto-dismiss both
  work; rendered toasts expose `role`/`aria-live`.

### Commit / push

- Commit: `289a3e9` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
