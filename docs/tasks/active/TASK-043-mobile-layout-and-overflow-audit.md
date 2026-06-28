# TASK-043: Mobile Layout and Overflow Audit

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make the app usable on narrow screens by fixing layout overflow, clipped text, and hard-to-reach actions across dashboard and module pages.

## 2. Requirements

- In scope:
  - Audit dashboard, planner, finance, health, growth, career, travel, AI modal, and sidebar on mobile widths.
  - Fix horizontal overflow, clipped buttons, hidden form actions, and unreadable dense sections.
  - Ensure map and modal surfaces keep stable dimensions on mobile.
- Out of scope:
  - Full visual redesign.
  - New mobile-only features.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Files reviewed: frontend dashboard/module pages, `globals.css`, shared components.
- Current behavior:
  - Recent travel map work adds more complex controls that need mobile QA.
  - Several pages use dense grids and compact action controls.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: Use responsive grid, wrapping, min-width, and stable height fixes consistent with current Tailwind style.
- Security impact: No security behavior change.

## 5. Test Plan

- Frontend/E2E tests: Add viewport checks for critical pages where practical.
- Manual validation: 375px, 390px, 768px, and desktop widths.
- Security checks: No security-specific checks needed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- No primary page has horizontal overflow on common mobile widths.
- Primary actions remain reachable.
- Travel map and AI modal remain usable on mobile.

## 8. PR Review Checklist

- Confirm fixes are responsive, not viewport-specific hacks.
- Confirm desktop layout remains polished.
- Confirm no text overlaps controls.
