# TASK-086: Feature-Grouped Navigation and Tracker Dialogs

status: working
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Reduce navigation and editing friction by grouping major features by user purpose and replacing
browser-native Tracker prompts with consistent, accessible application dialogs.

## 2. Requirements

- Group navigation into Today, Plan, Records, Life Management, and Support sections.
- Preserve every current destination and active-route behavior.
- Keep the mobile menu compact and scrollable.
- Replace Tracker setting and entry edit prompts with typed in-app forms.
- Replace Tracker destructive confirmations with a named in-app confirmation dialog.
- Disable repeated submissions while a request is pending.

## 3. Current Structure Analysis

- Files reviewed: `frontend/components/Sidebar.tsx`, Tracker page, dashboard quick links, shared components.
- The Sidebar is a flat list despite features serving distinct purposes.
- Tracker editing uses native `prompt()`/`confirm()`, which is visually inconsistent and difficult to
  test or use with assistive technology.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: introduce navigation section metadata and reusable dialog shell; use controlled Tracker
  edit and confirmation forms with focusable labels and clear cancel/save actions.
- Security impact: preserve explicit destructive confirmation, server validation, and authenticated
  APIs; do not render untrusted HTML.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend: ESLint, TypeScript, and production build.
- Manual/E2E: grouped desktop/mobile navigation, active states, Tracker settings edit, entry edit,
  archive, restore, record delete, and Tracker delete.
- Security checks: destructive actions remain explicit and cannot be double-submitted.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Major features are visibly grouped by purpose.
- All existing routes remain reachable.
- Tracker edit flows no longer use `prompt()`.
- Tracker deletion and archive use an application confirmation dialog.
- Busy states prevent duplicate mutation requests.
- Frontend validation passes.

## 8. PR Review Checklist

- Confirm navigation hierarchy is understandable without hiding features.
- Confirm keyboard users can identify and operate dialog controls.
- Confirm cancel never writes data.
- Confirm destructive copy identifies the affected item.
- Confirm mobile navigation remains usable at small heights.
