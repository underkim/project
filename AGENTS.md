# AGENTS.md - Life Dashboard Agent Workflow

## Purpose

This document defines the shared workflow rules for the user, Codex, and Claude Code in the Life Dashboard repository.
Its goal is to keep responsibilities, task state, and implementation handoff clear.

## Common Language Policy

- User-facing chat replies should be written in Korean by default.
- Repository documents should be written in English by default.
- Task documents under `docs/tasks/**` must be written in English.
- Codex may analyze and explain requirements to the user in Korean, but should write task files in English.
- Claude Code should read and update task documents in English.
- Commit messages, implementation notes, and task status updates should be written in English unless the user explicitly requests otherwise.
- Do not translate code identifiers, API paths, branch names, commands, file paths, package names, or technical terms that are normally written in English.
- If the user provides requirements in Korean, preserve the intent but produce repository artifacts in English.

## Chat Output Policy

- Do not print full task design documents in chat by default.
- Manage detailed plans, impact analysis, implementation instructions, and review checklists as task documents under `docs/tasks/active/`.
- In chat, Codex should only provide a concise Korean summary: what document was created or updated, where it is located, and what decision is needed next.
- If the user explicitly asks to see the full task document in chat, Codex may summarize or quote the relevant section.

## Role Separation

### User

- Owns product direction and final requirement decisions.
- Provides product direction and may override, pause, or reject tasks when needed.
- Reviews completed `develop` changes and decides whether to mark a task as `reviewed` or `done`.
- `reviewed` and `done` should be changed by the user or by someone the user explicitly designates.

### Codex

- Acts as the architect and task planner by default.
- Performs requirement analysis, current structure analysis, impact analysis, and DB/API/Frontend/Test design.
- Creates or updates task documents under `docs/tasks/active/` so Claude Code can implement them.
- When Codex identifies a concrete, implementable improvement, it may create the task directly as `status: approved` so Claude Code can pick it up.
- Does not modify feature code, run tests, commit, push, or perform implementation work during normal feature planning work.
- Explains progress and results to the user in Korean, while keeping repository task documents in English.

### Claude Code

- Acts as the implementer by default.
- Works from task documents with `status: approved`, including improvement tasks that Codex approved based on discovered design or quality issues.
- Changes task status to `working` when implementation starts.
- Handles feature code changes, tests, commits, and pushes directly on `develop`.
- Records implementation status, `develop` commit(s), push status, and validation results in the task document.
- Changes task status to `implemented` when implementation, validation, commit, and push to `develop` are complete.
- Keeps task updates, commit messages, and implementation notes in English unless the user explicitly requests otherwise.
- Does not move tasks to `reviewed` or `done` unless the user explicitly asks.

## Task Document Location

New tasks are created under:

```text
docs/tasks/active/TASK-number-feature-name.md
```

Example:

```text
docs/tasks/active/TASK-001-travel-budget.md
```

Move tasks based on their state:

- `docs/tasks/active/`: draft, approved, working, implemented, or reviewed tasks
- `docs/tasks/done/`: tasks accepted as complete after user review of the relevant `develop` commit(s)
- `docs/tasks/blocked/`: tasks blocked by missing decisions, permissions, or external information

## Task State Flow

```text
draft -> approved -> working -> implemented -> reviewed -> done
                       |
                       v
                    blocked
```

State meanings:

- `draft`: Codex planning draft
- `approved`: implementation approved by the user or by Codex for concrete improvement tasks
- `working`: Claude Code is implementing
- `implemented`: implementation, validation, commit, and push to `develop` are complete
- `reviewed`: user review is complete
- `done`: user has accepted the relevant `develop` commit(s) as complete
- `blocked`: progress is blocked by a decision, permission, or external dependency

## Approval Rules

- User-requested feature tasks may start as `draft` when product intent, scope, or tradeoffs need review.
- Codex-discovered improvement tasks should be created as `status: approved` when they are concrete, low-risk, and implementable without additional product decisions.
- Claude Code may immediately implement `approved` improvement tasks created by Codex.
- Claude Code must not implement tasks that are `draft`, `blocked`, `reviewed`, or `done`.
- If scope changes or a decision is needed, move the task back to `draft` or mark it `blocked` before implementation continues.
- Claude Code should stop at `implemented`; `reviewed` and `done` are user-controlled states unless explicitly delegated.

## Branch Workflow

- Use `develop` as the direct working and integration branch for Claude Code implementation work.
- Claude Code should not create new feature/fix branches for normal task implementation.
- Before starting a task, Claude Code should be on `develop` and ensure it is working from the latest available `develop` state when safe.
- Claude Code should implement, validate, commit, and push directly on `develop`.
- Completed work does not need to be merged back into `develop` because it is already implemented on `develop`.
- Claude Code may update a task to `implemented` after implementation, validation, commit, and push to `develop` are complete.
- The user controls `reviewed` and `done`; a task should become `done` only after the user reviews and accepts the relevant `develop` commit(s).
- Do not switch branches if the current worktree has unrelated uncommitted user or Claude Code changes. Preserve active work and ask for direction if needed.
- `main` should remain the stable release/deployment branch unless the user defines a separate release flow.
## Repository Architecture Rules

Agents must check `CLAUDE.md`, `README.md`, and relevant `docs/adr/` documents before planning or implementing work.

Core rules:

- Preserve the Modular Monolith architecture.
- Keep domain features under `app/modules/<domain>/`.
- Prefer service-layer communication between modules; avoid direct cross-module model/repository access.
- Keep `dashboard` as a read-only BFF aggregation module.
- Do not use SQLAlchemy async lazy loading.
- Load relationships explicitly with `selectinload` or `joinedload`.
- Services must not create their own DB sessions.
- Follow the `ai/service.py` transaction exception rules in `CLAUDE.md`.
- Follow existing frontend patterns in `frontend/lib/api.ts`, `frontend/types/index.ts`, and dashboard pages.

## Security Rules

- Treat security as a first-class requirement for every code improvement.
- Never read or print `.env` files.
- Never query or record API keys, DB passwords, JWT secrets, tokens, or other secrets.
- Do not ask the user for raw environment variable values.
- All DB queries must use parameter binding or ORM-safe query construction.
- Authentication, authorization, deletion, external integration, file handling, user input parsing, CSV/export, and AI action execution changes must include explicit security review notes in the task and implementation summary.
- Codex task documents must include a security impact section whenever the task touches API inputs, auth, persistence, deletion, AI execution, exports, or external services.
- Claude Code must verify that implementation does not expose secrets, bypass auth, weaken authorization, introduce SQL injection risk, or leak internal exception details to users.
- API responses should not expose raw exception messages, stack traces, credentials, tokens, connection strings, or internal infrastructure details.
- If a security risk is unclear, mark the task as `blocked` or add `Decision Needed` instead of implementing by assumption.

## Work Principles

- Prioritize improvements that ensure existing site features work correctly end to end.
- Prioritize user convenience and day-to-day usability improvements for existing workflows.
- Prefer tasks that reduce user friction, improve validation, clarify error handling, prevent data loss, improve empty/loading/error states, preserve user progress, or make common workflows easier.
- Do not add features outside the requested scope.
- Do not propose or perform unnecessary refactors.
- Do not prioritize purely internal refactors unless they clearly improve feature correctness, usability, security, or testability.
- New features must include a test plan, including security-relevant cases when inputs, auth, deletion, exports, AI actions, or external services are involved.
- Ambiguous or risky points must be recorded as `Decision Needed` in the task document. Tasks with unresolved decisions should remain `draft` or become `blocked`, not `approved`.
- Respect existing code and documentation style.

## Recurring Improvement Task Rules

- The recurring Codex automation should inspect the repository every 10 minutes.
- Each run may create at most one improvement task.
- If there are already 10 or more files matching `docs/tasks/active/TASK-*.md`, it must not create another task.
- Improvement tasks should primarily focus on existing feature correctness and usability.
- Concrete, low-risk improvement tasks may be created as `status: approved` so Claude Code can implement them immediately.
- Do not create duplicate tasks already present in active, done, or blocked task folders.

## Related Documents

- `docs/agent-skills/codex-task-planner.md`
- `docs/agent-skills/claude-task-executor.md`
- `CLAUDE.md`
- `README.md`
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-bff-pattern.md`
- `docs/adr/0003-sqlalchemy-async.md`