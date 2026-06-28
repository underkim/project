# TASK-042: Frontend Form Validation and Submit Guards

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Reduce failed saves and accidental duplicate submissions by making form validation and submit guards consistent across all module pages.

## 2. Requirements

- In scope:
  - Audit create/edit forms for required fields, date ranges, numeric ranges, and duplicate-click guards.
  - Add inline validation where the user can fix the problem before submitting.
  - Ensure submit buttons show loading state and are disabled during mutation.
  - Keep backend validation as the final source of truth.
- Out of scope:
  - Changing domain validation rules.
  - Replacing the existing toast system.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Files reviewed: module pages, `frontend/lib/api.ts`, module schemas under `app/modules/*/schemas.py`.
- Current behavior:
  - Several mutation guard tasks have been completed, but validation UX is still spread across pages.
  - Some invalid submissions rely on backend errors rather than pre-submit guidance.

## 4. Design

- Backend/API: No change unless a validation response is currently ambiguous.
- DB: No change.
- Frontend: Add local validators and unified disabled/loading states in touched forms.
- Security impact: Do not trust frontend validation; keep backend validation intact.

## 5. Test Plan

- Backend tests: No backend change expected.
- Frontend/E2E tests: Verify invalid forms cannot submit and valid forms still save.
- Security checks: Verify backend still rejects invalid direct API payloads.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Required field and range errors are visible before submit.
- Duplicate submissions are prevented during pending saves.
- Existing save success flows still work.

## 8. PR Review Checklist

- Confirm validation text is concise and actionable.
- Confirm backend validation remains authoritative.
- Confirm no unrelated forms were redesigned.
