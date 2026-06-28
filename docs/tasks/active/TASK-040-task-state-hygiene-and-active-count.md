# TASK-040: Task State Hygiene and Active Count

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Prevent automation and agents from mistaking implemented task documents for unfinished active work by making task state counting and task folder hygiene explicit and reliable.

## 2. Requirements

- In scope:
  - Audit task folders and current task statuses.
  - Document the active-work count rule: unfinished work is `draft`, `approved`, or `working`, not every file under `docs/tasks/active/`.
  - Add or update a lightweight script, documentation note, or agent instruction that reports unfinished task counts by status.
  - Ensure recurring automation does not create new work based only on `memory.md` or active folder file count.
  - Recommend a safe process for moving user-accepted `implemented` tasks to `done`.
- Out of scope:
  - Marking implemented tasks as `done` without explicit user review/acceptance.
  - Reverting existing task document history.
  - Changing feature code.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `docs/agent-skills/codex-task-planner.md` if present, task docs under `docs/tasks/active/` and `docs/tasks/done/`.
- Files reviewed: current task documents and any automation/task planner documentation found in the repository.
- Current behavior:
  - Many task files remain under `docs/tasks/active/` with `status: implemented`.
  - The user previously observed automation incorrectly thinking there were tasks because it read memory or active files instead of status.
  - User-controlled states are `reviewed` and `done`; agents must not move implemented tasks to done without explicit user acceptance.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: No change.
- Task workflow:
  - Define unfinished task count as statuses `draft`, `approved`, and `working`.
  - Treat `blocked` separately from available active work.
  - Treat `implemented`, `reviewed`, and `done` as not available for Claude Code implementation.
  - Add a status-count command or script that agents can run before creating tasks.
  - Update task planner docs to avoid using `memory.md` as source of truth for current task availability.
- Security impact:
  - No app security behavior change.
  - Do not read or print secrets while scanning task docs.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests: No frontend change.
- Workflow validation:
  - Run the task count command or script and verify it reports implemented tasks separately.
  - Verify the current unfinished active count matches task status, not active folder file count.
  - Verify documentation explicitly says not to move implemented tasks to done without user acceptance.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Do not move implemented tasks to `done` unless the user explicitly asks in the same work session.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- There is a clear source-of-truth rule for unfinished task counting.
- Automation guidance no longer relies on active folder file count alone.
- Implemented tasks are reported separately from actionable tasks.
- The user-controlled nature of `reviewed` and `done` remains preserved.

## 8. PR Review Checklist

- Confirm no user review state was changed without permission.
- Confirm the count rule matches `AGENTS.md`.
- Confirm automation guidance avoids `memory.md` as active task source of truth.
- Confirm no unrelated task docs were modified.
