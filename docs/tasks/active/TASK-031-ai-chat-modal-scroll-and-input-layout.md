# TASK-031: AI Chat Modal Scroll and Input Layout

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Fix the AI chat modal layout so long conversations scroll inside the message area instead of expanding the whole modal upward. The input composer must remain reachable at the bottom of the modal, and users must be able to scroll up and down through previous messages normally.

## 2. Requirements

- In scope:
  - Constrain the AI modal to a stable viewport-relative height on desktop and mobile.
  - Ensure only the message list scrolls when conversation content grows.
  - Keep the header and input composer fixed within the modal layout.
  - Preserve automatic scroll-to-bottom behavior for new messages only when appropriate.
  - Allow users to scroll upward to read earlier messages without being forced back to the bottom.
  - Keep the existing "scroll to latest" button behavior or improve it if needed.
- Out of scope:
  - No AI API behavior changes.
  - No chat history persistence changes unless directly required by layout behavior.
  - No visual redesign beyond layout sizing and scroll behavior.
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
- Current behavior:
  - The modal uses `fixed bottom-24 ... max-h-[70vh] flex flex-col ... overflow-hidden`.
  - The message list is nested inside a `flex-1 min-h-0` region, but the modal itself does not have a stable explicit height.
  - Long conversations can make the modal grow upward, pushing the input composer into an awkward position.
  - The effect that depends on `[open, messages]` scrolls to bottom whenever messages change, which can fight the user's attempt to scroll up.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Give the modal a stable responsive height, such as `h-[min(...)]` or paired `max-h`/`height` constraints appropriate for desktop and mobile.
  - Keep the header and composer as `shrink-0`.
  - Keep the message viewport as `flex-1 min-h-0 overflow-y-auto`.
  - Adjust auto-scroll logic so it does not always force the user to the latest message when they are reading older content.
  - Recalculate the scroll-to-latest button state after message updates and manual scrolling.
  - Verify the textarea auto-resize remains capped and does not push the modal off-screen.
- Security impact:
  - No security surface change expected.
  - Do not log chat content or AI responses while debugging layout.
  - Preserve delete confirmation and AI action behavior.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend checks:
  - Run `cd frontend && npx tsc --noEmit`.
  - Run `cd frontend && npm run build`.
- Manual validation:
  - Open AI chat and send enough messages to exceed the modal height.
  - Verify the modal stays anchored near the bottom-right and does not grow upward indefinitely.
  - Verify the input composer remains visible and usable.
  - Scroll upward and verify it stays at the user's chosen position while reading.
  - Send a new message while near the bottom and verify it scrolls to the latest response.
  - Test narrow/mobile viewport sizing.
- Security checks:
  - Confirm no chat text is printed to console or logs.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Long AI conversations scroll inside the message list.
- Header and input composer remain fixed within the modal.
- Users can scroll up and down through chat history normally.
- Auto-scroll does not fight the user when they are reading older messages.
- Frontend typecheck and production build pass.
- Task document records implementation notes, validation results, commit hash, and push status.

## 8. PR Review Checklist

- Modal height is stable across desktop and mobile.
- Message list owns scrolling.
- Textarea growth is capped and cannot push the composer out of reach.
- Auto-scroll behavior is respectful and predictable.
- No unrelated AI modal redesign is included.

## 9. Implementation Notes

### Change (`frontend/components/AiModal.tsx`) — frontend only

1. **Stable modal height** — the panel changed from `max-h-[70vh]` (which let
   the modal grow upward with content) to a fixed responsive height
   `h-[min(70vh,560px)]`. The panel stays `flex flex-col overflow-hidden`, the
   header and input composer remain `shrink-0`, and the message viewport keeps
   `flex-1 min-h-0` + inner `h-full overflow-y-auto`. As a result only the
   message list scrolls; the composer is always anchored at the bottom.
2. **Respectful auto-scroll** — added `atBottomRef` (tracks whether the user is
   within 80px of the bottom, updated in `handleScroll`). The previous single
   effect on `[open, messages]` that always jumped to the bottom was split into:
   - an `[open]` effect that focuses the input and jumps to the bottom
     (`behavior: 'auto'`, sets `atBottomRef = true`);
   - a `[messages, open]` effect that smooth-scrolls to the latest message
     **only when `atBottomRef` is true**, so a user reading older messages is no
     longer yanked down when a new message arrives.
   `scrollToBottom()` (the "scroll to latest" button) sets `atBottomRef = true`
   to resume auto-follow.

Textarea auto-resize remains capped at 120px (`autoResize`, unchanged). No AI
API, history-persistence, or delete-confirmation behavior changed. No chat
content is logged.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm run build` → success, all 11 routes generated.
- Manual: long conversation scrolls inside the message list with the composer
  fixed at the bottom; scrolling up stays put when new messages arrive; sending
  a message (user at bottom) scrolls to the latest; "scroll to latest" button
  re-anchors; narrow/mobile uses 70vh, desktop caps at 560px.

### Commit / push

- Commit: `2d279ed` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
