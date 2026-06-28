# TASK-048: Critical Path E2E Smoke Stabilization

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Stabilize end-to-end smoke coverage for the workflows most likely to break production usage.

## 2. Requirements

- In scope:
  - Audit existing Playwright tests for login, dashboard, finance, health, growth, and travel.
  - Add or harden smoke tests for AI modal visibility, dashboard overview, and travel map/restaurant workflows.
  - Reduce brittle selectors by using accessible labels or stable test hooks where appropriate.
  - Keep tests fast enough for CI.
- Out of scope:
  - Exhaustive visual regression testing.
  - Testing every field permutation.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, CI/CD task docs.
- Files reviewed: `frontend/e2e/*.spec.ts`, `frontend/playwright.config.ts`, frontend page components.
- Current behavior:
  - E2E tests exist for core modules.
  - Recent travel map features add workflows that need smoke coverage.

## 4. Design

- Backend/API: No app behavior change expected.
- DB: Use existing test setup; avoid depending on production data.
- Frontend: Add stable selectors only where user-visible labels are insufficient.
- Security impact: Do not commit test credentials beyond existing env-based pattern.

## 5. Test Plan

- Run targeted Playwright specs.
- Run full E2E suite where feasible.
- Verify CI configuration remains compatible.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Critical path E2E tests cover login, dashboard, and travel map workflows.
- Tests use stable selectors.
- CI can run the suite without excessive flake.

## 8. PR Review Checklist

- Confirm tests do not require real secrets.
- Confirm selectors reflect user-facing behavior where possible.
- Confirm travel map tests tolerate external tile loading variance.
