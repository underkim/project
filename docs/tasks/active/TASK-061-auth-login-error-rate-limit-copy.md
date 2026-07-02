# TASK-061: Auth Login Error and Rate Limit Copy

status: approved
created_by: codex
created_at: 2026-07-01
updated_at: 2026-07-01
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal
Login errors should be helpful without enabling account enumeration. This improves existing feature correctness and day-to-day usability without adding unrelated scope.

## 2. Requirements
- In scope: inspect the current auth workflow and implement the smallest safe improvement that satisfies the goal.
- In scope: preserve existing architecture, API client conventions, and user workflows.
- In scope: keep user-facing copy concise, actionable, and consistent with nearby pages.
- Out of scope: broad visual redesigns, unrelated refactors, and new third-party services.
- Out of scope: changing authentication or authorization semantics except where explicitly required by the task.

## 3. Current Structure Analysis
- Docs reviewed: AGENTS.md, CLAUDE.md, frontend/README.md, docs/adr/0001-modular-monolith.md, docs/adr/0002-bff-pattern.md, docs/adr/0003-sqlalchemy-async.md.
- Files reviewed: app/modules/auth/router.py, app/modules/auth/service.py, frontend/app/(auth)/login/page.tsx.
- Current behavior: the related feature exists, but the workflow can be made safer, clearer, or more resilient.
- Current behavior: backend modules are organized under app/modules/<domain>/ and frontend pages use frontend/lib/api.ts patterns.

## 4. Design
- Backend/API: Review and update the relevant service/router behavior while preserving module boundaries.
- DB: No change.
- Frontend: Update the relevant UI state, feedback, and validation paths.
- Security impact: Validate inputs and show sanitized errors; do not expose secrets, raw exceptions, stack traces, connection strings, or cross-user data.

## 5. Test Plan
- Backend tests: add or update targeted cases for the changed endpoint/service behavior.
- Frontend/E2E tests: cover loading, success, empty/error, and user interaction states relevant to this task.
- Security checks: verify validation, authorization boundaries, and sanitized error handling for touched paths.

## 6. Claude Code Instructions
- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria
- The task goal is satisfied with a focused implementation.
- Existing behavior outside this scope remains unchanged.
- Relevant automated tests or manual validation steps are recorded.
- Security impact notes are addressed.
- Task status is updated according to the repository workflow.

## 8. PR Review Checklist
- Confirm the implementation stays within the task scope.
- Confirm user-facing feedback is clear and does not expose internals.
- Confirm API or DB changes preserve module boundaries and safe query construction.
- Confirm frontend states cover loading, empty, success, and failure where relevant.
- Confirm no secrets, tokens, or raw exception details are logged or rendered.
