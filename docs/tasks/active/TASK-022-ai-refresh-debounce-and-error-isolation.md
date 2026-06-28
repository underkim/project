# TASK-022: AI Refresh Debounce and Error Isolation

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Prevent AI-triggered page refresh events from causing duplicate loads or unhandled refresh failures. When AI saves multiple records or modules, dashboard pages should refresh predictably without flooding APIs or leaving hidden rejected promises.

## 2. Requirements

- In scope:
  - Improve `useAiRefresh` so refresh calls are debounced or coalesced per page.
  - Ensure refresh errors do not escape the event handler.
  - Keep module prefix matching behavior intact.
  - Allow pages to opt into a short debounce window without changing every caller.
  - Add focused tests or manual validation instructions for multi-save events.
- Out of scope:
  - No AI backend prompt changes.
  - No page-specific data model changes.
  - No changes to the `ai-data-saved` event payload unless strictly needed.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/hooks/useAiRefresh.ts`, `frontend/components/AiModal.tsx`, dashboard pages under `frontend/app/(dashboard)/`
- Current behavior:
  - `dispatchAiSaved()` emits one event per saved module.
  - `useAiRefresh()` calls `onRefreshRef.current()` immediately for each matching event.
  - Multi-action AI saves can trigger several rapid refreshes.
  - The hook does not catch refresh errors or handle async return values.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Update `useAiRefresh` to coalesce rapid matching events with a short default delay, such as 100-250ms.
  - Support both sync and async refresh callbacks.
  - Catch callback failures and optionally log a safe development-only message without exposing data.
  - Clear pending timers on unmount.
  - Keep dependency behavior stable and avoid stale callback captures.
- Security impact:
  - No secret or auth behavior change.
  - Do not log saved AI content, module data, tokens, or request payloads.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/manual tests:
  - Dispatch multiple `ai-data-saved` events quickly and verify each page refreshes once.
  - Verify non-matching module events do not refresh the page.
  - Verify async refresh rejection does not crash the UI.
  - Verify dashboard-wide listeners still refresh on any module.
- Security checks:
  - No sensitive AI payloads are logged.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Rapid AI save events are coalesced.
- Refresh failures are isolated from the event handler.
- Existing module matching semantics are preserved.
- Pages using `useAiRefresh` continue to refresh after AI saves.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Hook remains small and easy to reason about.
- Timers are cleaned up on unmount.
- No sensitive data is logged.
- Existing page callers need minimal or no changes.

## 9. Implementation Notes

### Change (`frontend/hooks/useAiRefresh.ts`)

- **Debounce/coalesce**: matching `ai-data-saved` events now schedule
  `runRefresh` via a `setTimeout` (default `debounceMs = 150`). A new matching
  event clears the previous pending timer, so a burst of multi-module saves
  (AI multi-action) results in a single refresh call instead of one per event.
- **Error isolation**: `runRefresh` wraps the callback in try/catch and, when
  the callback returns a Promise, attaches a `.catch`. Refresh failures can no
  longer escape the event handler as unhandled rejections / exceptions. In
  non-production only a safe one-line message is logged (error message string,
  never AI payloads, module data, tokens, or request bodies).
- **Async support**: signature widened to
  `onRefresh: () => void | Promise<void>`; sync callers are unaffected.
- **Timer cleanup**: the effect's cleanup clears any pending timer on unmount or
  when `modules`/`debounceMs` change.
- **Module matching preserved**: same `modules.length === 0 || prefix-startsWith`
  logic; `[]` still refreshes on any module.
- Also moved the `onRefreshRef.current = onRefresh` assignment into a
  `useEffect` (was an assignment during render) — removes a pre-existing
  `react-hooks/refs` lint error and follows the recommended ref pattern.

Optional third arg means **no existing caller needs changes** (all use the
default 150ms window).

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `npm run lint` → project error count dropped 15 → 14 (the fixed ref error);
  remaining errors are pre-existing `set-state-in-effect` warnings in unrelated
  page files. No backend change.
- No frontend unit-test runner exists (only Playwright e2e), so per the task's
  "tests OR manual validation" allowance, manual steps below.

### Manual validation

1. Open the AI modal, ask it to save records spanning multiple modules in one
   message (e.g. "오늘 러닝 40분, 어제 수면 7시간"). The health page (if open)
   refreshes **once** ~150ms after the saves, not once per saved record.
2. Trigger an AI save for a module a page does not subscribe to and confirm that
   page does not refetch.
3. Temporarily make a page's `load()` reject and confirm the UI does not crash
   and (dev) a single safe warning appears, with no payload contents.

### Commit / push

- Commit: `084ad02` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
