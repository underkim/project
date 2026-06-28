# TASK-016: AI Chat History Storage Resilience

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make the AI assistant modal resilient when browser storage is unavailable, full, or contains malformed chat history. The chat should keep working even if `localStorage` operations fail.

## 2. Requirements

- In scope:
  - Wrap AI chat history reads, writes, and clears in safe helpers.
  - If saved history is malformed, discard it without breaking the modal.
  - If `localStorage.setItem` fails because of quota or browser restrictions, keep the in-memory chat usable and show at most one non-disruptive warning.
  - Keep the existing limit of recently saved messages or reduce it if needed to avoid quota failures.
  - Ensure copy-to-clipboard failure does not leave the copy button in a false success state.
- Out of scope:
  - No backend AI behavior changes.
  - No changes to prompt content or AI actions.
  - No new persistence backend for chat history.
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
  - `frontend/components/AiModal.tsx`
  - `frontend/lib/api.ts`
  - `frontend/lib/toast.ts`
  - `app/modules/ai/router.py`
  - `app/modules/ai/service.py`
- Current behavior:
  - AI modal loads `ai-chat-history` from `localStorage` inside the state initializer.
  - Malformed saved JSON is caught and ignored.
  - Chat history writes happen in an effect with `localStorage.setItem` and no error handling.
  - Clearing history calls `localStorage.removeItem` directly.
  - Copy button sets copied state even if `navigator.clipboard.writeText` fails.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Add small local helper functions in `AiModal.tsx` for safe load, save, and clear of chat history.
  - Catch storage write/remove failures and avoid crashing the component.
  - Keep only serializable message fields in saved history and exclude transient fields such as `confirmLoading`.
  - Consider trimming saved messages further if serialized size is large.
  - Update copy behavior so copied success state is set only after `writeText` resolves.
  - Use `showToast` only when useful and avoid repeated warnings on every render.
- Security impact:
  - This task touches local persistence of AI chat text.
  - Do not persist tokens, credentials, or hidden request metadata.
  - Do not add logging that prints chat history or user data to the console.
  - Deletion confirmation state must not be persisted as active after reload.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests:
  - Manually seed malformed `ai-chat-history` and verify the modal opens normally.
  - Simulate `localStorage.setItem` throwing and verify chat sending still works.
  - Verify clearing chat does not crash when storage remove fails.
  - Verify copy button only shows success after clipboard write succeeds.
  - Verify pending delete confirmation is not restored as loading after reload.
- Security checks:
  - Saved history contains only visible message content and safe metadata.
  - No secrets or tokens are read from or written to chat history.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- AI modal does not crash when chat history storage read/write/remove fails.
- Malformed saved history is discarded safely.
- Storage warnings are non-disruptive and not repeated excessively.
- Copy success state reflects actual clipboard success.
- Existing AI chat, weekly report, and delete confirmation flows still work.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Storage helpers are small and local to the AI modal unless an existing shared helper is clearly appropriate.
- No chat history or secrets are logged.
- Failure handling does not interrupt active chat usage.
- Transient delete confirmation loading state is not persisted.
- UI behavior remains consistent on mobile and desktop.
