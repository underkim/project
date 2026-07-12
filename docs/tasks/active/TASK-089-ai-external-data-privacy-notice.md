# TASK-089: AI External Data Privacy Notice

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Ensure users understand that enabling AI sends conversation and relevant dashboard context to an
external Gemini service before they use chat or weekly reports.

## 2. Requirements

- Show a persistent, concise privacy notice inside the AI panel.
- State that chat and relevant dashboard context may be sent to Gemini.
- Warn users not to enter passwords, API keys, or highly sensitive information.
- Remove legacy Growth-specific example prompts from the generalized product UI.

## 3. Current Structure Analysis

- AI context includes multiple personal modules and weekly-report aggregates.
- The modal currently offers actions without an external-provider privacy explanation.
- A book-specific example remains after Growth was replaced by configurable Trackers.

## 4. Design

- Backend/API/DB: No change.
- Frontend: add a visible non-dismissible informational notice below the AI header.
- Security impact: disclosure improves informed use but does not replace future module-level context
  controls or provider-side privacy review.

## 5. Test Plan

- Frontend ESLint, TypeScript, and production build.
- Verify notice is visible whenever the AI panel opens.
- Verify legacy Growth example is absent.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- External Gemini data transfer is clearly disclosed.
- Secret-entry warning is visible before typing.
- Legacy example prompts are removed.

## 8. PR Review Checklist

- Confirm wording is accurate and not alarmist.
- Confirm no secret or provider key is displayed.
- Confirm notice does not prevent ordinary AI use.

## 9. Implementation Result

- Added a persistent notice explaining external Gemini transfer of chat and relevant dashboard data.
- Added an explicit warning against entering passwords, API keys, or other sensitive information.
- Replaced the legacy book-specific suggestion with a current health-record example.
- Implementation commit: `781c3f5`.
- Validation: frontend ESLint, TypeScript, and production build passed.
