# TASK-013: Recurring Automation Task Source of Truth

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Prevent the recurring Codex improvement automation from wasting tokens or making incorrect task-count decisions by relying on stale memory/context files. The automation must use the repository task folders as the source of truth for existing tasks, especially `docs/tasks/active/`.

## 2. Requirements

- In scope:
  - Update the recurring improvement workflow instructions so task-count checks use `docs/tasks/active/TASK-*.md` from the filesystem.
  - Require the automation to ignore `memory.md`, conversation summaries, prior chat context, or cached task lists when deciding whether active tasks exist.
  - Require a lightweight preflight check before any broad repository scan.
  - Keep duplicate detection based on actual task documents in `docs/tasks/active/`, `docs/tasks/done/`, and `docs/tasks/blocked/`.
  - Add a concise note that stale memory may be used only as background context, never as task inventory.
- Out of scope:
  - No feature code changes.
  - No database, API, or frontend behavior changes.
  - No changes to completed task content except if needed to preserve task workflow consistency.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `README.md`
  - `docs/adr/0001-modular-monolith.md`
  - `docs/adr/0002-bff-pattern.md`
  - `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `docs/tasks/active/`
  - `docs/tasks/done/`
  - `docs/tasks/blocked/`
- Current behavior:
  - The task workflow defines `docs/tasks/active/` as the location for draft, approved, working, implemented, and reviewed tasks.
  - The recurring automation rule says not to create another task when 10 or more files match `docs/tasks/active/TASK-*.md`.
  - After completed implemented tasks were moved to `docs/tasks/done/`, `docs/tasks/active/` contained 0 task files.
  - A recurring automation run reportedly used stale `memory.md` information and incorrectly believed active tasks still existed.
  - This caused unnecessary token use and blocked the expected creation of a new improvement task.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend: No change.
- Agent workflow:
  - Amend the recurring improvement task rules so the first check is a filesystem inventory:
    - Count files matching `docs/tasks/active/TASK-*.md`.
    - If the count is 10 or more, stop before broad repository analysis.
    - If the count is below 10, inspect active/done/blocked task documents only as needed for duplicate detection.
  - Explicitly state that `memory.md`, compacted context, chat history, or cached summaries are not authoritative for task existence or task status.
  - Prefer short targeted searches over broad scans until the active task count gate passes.
- Security impact:
  - No application security surface changes.
  - The workflow should continue to avoid reading or printing `.env`, secrets, tokens, connection strings, and private credentials.
  - The preflight check should inspect task paths only and must not scan secret-bearing files.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests: No frontend change.
- Workflow validation:
  - Confirm `docs/tasks/active/TASK-*.md` is counted from the filesystem, not inferred from memory.
  - Confirm stale task names in memory/context do not block new task creation when active is empty.
  - Confirm duplicate detection still checks task documents in active, done, and blocked folders.
  - Confirm the automation stops early when active has 10 or more matching files.
- Security checks:
  - Confirm workflow guidance does not require reading `.env` or secret-bearing files.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Recurring automation instructions identify `docs/tasks/active/TASK-*.md` as the authoritative active task count.
- Instructions explicitly forbid using `memory.md` or cached context as task inventory.
- The active-count gate is described as a preflight check before broad repository analysis.
- Duplicate detection still covers active, done, and blocked task documents.
- Security guidance still avoids secrets and `.env` files.
- Task document is updated with implementation notes and validation results.

## 8. PR Review Checklist

- Active task count is based on filesystem state only.
- `memory.md` and compacted summaries cannot override task folder state.
- The automation can create a new task when `docs/tasks/active/` is empty.
- Existing task state flow remains intact.
- No unrelated workflow or feature behavior was changed.
- Security rules around secrets are preserved.
