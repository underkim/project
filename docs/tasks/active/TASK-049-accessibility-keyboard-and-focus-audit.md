# TASK-049: Accessibility Keyboard and Focus Audit

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Improve keyboard usability and focus behavior across modals, forms, maps, navigation, and repeated action controls.

## 2. Requirements

- In scope:
  - Audit AI modal, weekly report modal, travel map controls, side navigation, and module forms.
  - Ensure buttons have accessible names and disabled states.
  - Add focus restoration after modal close where needed.
  - Ensure keyboard users can cancel, save, and navigate primary workflows.
- Out of scope:
  - Full WCAG certification.
  - Screen reader copy rewrite for every component.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, frontend guidance.
- Files reviewed: shared components, dashboard layout, AI modal, travel map components, module pages.
- Current behavior:
  - Icon buttons and modals exist across the app.
  - Recent map interactions introduce more keyboard/focus risk.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: Add labels, focus management, keyboard handlers, and semantic button states.
- Security impact: No direct security behavior change.

## 5. Test Plan

- Frontend/E2E tests: Add keyboard navigation checks for selected critical paths.
- Manual validation: Tab order, Escape close, focus return, disabled button state.
- Security checks: No security-specific checks needed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Primary modal flows have sane focus behavior.
- Icon-only controls have accessible names.
- Keyboard users can complete core save/cancel flows.

## 8. PR Review Checklist

- Confirm labels are meaningful and not noisy.
- Confirm focus is not trapped unintentionally.
- Confirm mouse behavior remains unchanged.
