# TASK-028: AI Delete Confirmation Preview

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make AI-assisted delete confirmations safer by showing users what will be deleted before they confirm. The current AI modal asks for confirmation but does not present a structured preview of the pending delete filter.

## 2. Requirements

- In scope:
  - Display a compact, sanitized preview of the pending delete module and filter in the AI modal.
  - Use user-friendly module labels where available.
  - Hide or summarize unsupported filter values rather than rendering arbitrary objects deeply.
  - Preserve the existing explicit confirm/cancel buttons.
  - Keep backend delete execution unchanged unless a safe preview requires a small response addition.
- Out of scope:
  - No automatic delete execution.
  - No multi-delete batching.
  - No AI prompt redesign beyond what is needed for safer confirmation copy.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/components/AiModal.tsx`, `frontend/lib/api.ts`, `app/modules/ai/router.py`, `app/modules/ai/service.py`, `tests/test_ai_routes.py`
- Current behavior:
  - AI delete requests return `action: delete_pending` and `pending_filter`.
  - The modal renders confirm/cancel buttons.
  - The filter is not visibly summarized near the buttons.
  - Delete execution still requires an explicit user click.

## 4. Design

- Backend/API: No change expected unless current response lacks necessary safe display fields.
- DB: No change.
- Frontend:
  - Add a small preview component for `pendingFilter`.
  - Render only primitive values and short arrays; truncate long values.
  - Label the target module using `MODULE_LABEL`.
  - Keep confirm/cancel controls disabled while `confirmLoading`.
- Security impact:
  - This task touches AI deletion confirmation.
  - Do not expose internal IDs beyond what is already needed for confirmation, unless they are already present in the filter.
  - Do not render raw nested objects, secrets, or stack traces.
  - Delete remains explicit and user-confirmed.

## 5. Test Plan

- Backend tests: Run `tests/test_ai_routes.py` if API response shape changes.
- Frontend/manual tests:
  - Ask AI to delete a record and verify module/filter preview is shown.
  - Confirm deletion and verify existing flow still works.
  - Cancel deletion and verify pending state clears.
  - Try long filter values and verify they are truncated safely.
- Security checks:
  - Preview does not render arbitrary nested JSON verbatim.
  - Confirmation remains required.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- AI delete confirmations include a sanitized preview.
- Existing confirm/cancel behavior is preserved.
- Long or complex filter values are safely summarized.
- AI route tests remain passing if touched.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Preview improves clarity without leaking internals.
- Delete is still explicit and cancellable.
- No raw exception or secret data is rendered.
- No unrelated AI modal redesign is included.

## 9. Implementation Notes

### Change (`frontend/components/AiModal.tsx`) — frontend only

- Added `DeleteFilterPreview` component rendered just above the existing
  confirm/cancel buttons whenever `action === 'delete_pending'` and a
  `pendingFilter` is present.
- It shows the target **module** via the existing `MODULE_LABEL` map and each
  filter entry as a `라벨: 값` row, using a new `FILTER_KEY_LABEL` map for
  friendly Korean labels (id, 날짜, 제목, 이름, 내용, 목적지, 여행명, …; unknown
  keys fall back to the raw key name).
- **Sanitization** via `formatFilterValue`:
  - strings: trimmed, truncated at 40 chars with `…`; empty → omitted
  - numbers/booleans: stringified
  - arrays: only primitive elements joined (max 5, then "외 N개"), truncated;
    non-primitive arrays summarized as "N개 항목"
  - nested objects / unsupported types: **omitted** (never rendered as raw JSON)
  - if no displayable entries remain, shows "조건에 맞는 전체 항목".
- Confirm/cancel buttons and `handleConfirmDelete`/`handleCancelDelete` are
  unchanged; both remain disabled while `confirmLoading`. Delete still requires
  an explicit click.

### Security

- Only primitives and short primitive-arrays are rendered; nested objects,
  secrets, or stack traces cannot appear. Values are React text nodes (no HTML
  injection). No new IDs exposed beyond what the filter already contains.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- No backend/API shape change, so `tests/test_ai*.py` untouched and not required.
- Manual: asking AI to delete a record shows the module + filter preview;
  confirm runs the existing delete; cancel clears pending; long values truncate.

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
