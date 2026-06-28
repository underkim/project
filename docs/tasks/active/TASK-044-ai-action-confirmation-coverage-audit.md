# TASK-044: AI Action Confirmation Coverage Audit

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Ensure AI-assisted create, update, and delete actions are consistently confirmed, previewed, and executed only once across all supported modules.

## 2. Requirements

- In scope:
  - Audit AI action flows for create, update, delete, and multi-action responses.
  - Verify follow-up questions cannot re-run previous mutations.
  - Ensure confirmation previews clearly show what will be changed.
  - Add missing tests for modules or actions not already covered.
- Out of scope:
  - New AI capabilities.
  - Changing the model provider.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, AI-related task docs.
- Files reviewed: `app/modules/ai/service.py`, `app/modules/ai/router.py`, `frontend/components/AiModal.tsx`, `tests/test_ai_routes.py`.
- Current behavior:
  - Recent tasks fixed travel confirmation and duplicate follow-up saves.
  - The remaining risk is uneven coverage across modules and action types.

## 4. Design

- Backend/API: Tighten action idempotency and confirmation gating where gaps are found.
- DB: No schema change expected.
- Frontend: Ensure pending action previews and execution results are clear.
- Security impact: This touches AI execution and persistence; avoid unconfirmed writes and raw error leakage.

## 5. Test Plan

- Backend tests: Add matrix coverage for create/update/delete per supported module where missing.
- Frontend/E2E tests: Verify pending confirmation UX and no duplicate execution.
- Security checks: Verify follow-up non-action prompts do not mutate data.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- AI mutations require explicit confirmation where intended.
- Follow-up questions do not repeat previous saves.
- Tests cover representative modules and action types.

## 8. PR Review Checklist

- Confirm no unconfirmed write path remains.
- Confirm multi-action behavior is deterministic.
- Confirm user-facing error text is sanitized.
