# TASK-090: AI Context Sharing Control

status: working
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Let users use AI chat without automatically sending stored Dashboard context to Gemini.

## 2. Requirements

- Add an explicit AI context-sharing toggle in the AI panel.
- Persist the choice locally on the installation's browser.
- When disabled, do not load Planner categories or personal module summaries for the Gemini prompt.
- Continue sending the user's typed chat message and recent chat history.
- Disable weekly reports when context sharing is off because reports require dashboard data.

## 3. Current Structure Analysis

- Chat always loads categories and broad personal context before calling Gemini.
- The frontend now discloses external transfer but cannot control it.

## 4. Design

- Backend: accept `context_enabled` and skip both context loaders when false.
- DB: No change.
- Frontend: locally persisted toggle adjacent to the privacy notice.
- Security impact: server-side enforcement prevents disabled context from being loaded or sent.

## 5. Test Plan

- Backend tests verify context loaders are skipped when disabled.
- Frontend lint, TypeScript, and production build.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Chat works with context sharing on or off.
- Disabled mode does not load stored dashboard context.
- Weekly reports clearly require context sharing.

## 8. PR Review Checklist

- Confirm toggle state is not treated as authentication.
- Confirm typed messages still go to Gemini.
- Confirm server-side loaders are skipped.
