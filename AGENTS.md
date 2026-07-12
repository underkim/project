# AGENTS.md - Life Dashboard Agent Workflow

## Purpose

This document defines the task workflow for the user and Claude Code in the Life Dashboard
repository. Claude Code is the sole agent: it plans (drafts task documents), implements, tests,
commits, and pushes. The user owns product direction and final acceptance.

(This repository previously used a two-agent split with a separate "Codex" planner. That role
has been removed — Claude Code now covers both planning and implementation.)

## Common Language Policy

- User-facing chat replies should be written in Korean by default.
- Repository documents should be written in English by default.
- Task documents under `docs/tasks/**` must be written in English.
- Commit messages, implementation notes, and task status updates should be written in English
  unless the user explicitly requests otherwise.
- Do not translate code identifiers, API paths, branch names, commands, file paths, package
  names, or technical terms that are normally written in English.
- If the user provides requirements in Korean, preserve the intent but produce repository
  artifacts in English.

## Chat Output Policy

- Do not print full task design documents in chat by default.
- Manage detailed plans, impact analysis, implementation instructions, and review checklists as
  task documents under `docs/tasks/active/`.
- In chat, give a concise Korean summary: what document was created or updated, where it is
  located, and what decision is needed next.
- If the user explicitly asks to see the full task document in chat, summarize or quote the
  relevant section.

## Role Separation

### User

- Owns product direction and final requirement decisions.
- Provides product direction and may override, pause, or reject tasks when needed.
- Reviews completed changes and decides whether to mark a task as `reviewed` or `done`.
- `reviewed` and `done` should be changed by the user or by someone the user explicitly
  designates.

### Claude Code

- Acts as both planner and implementer.
- When planning: performs requirement analysis, current structure analysis, impact analysis,
  and DB/API/Frontend/Test design; creates or updates task documents under
  `docs/tasks/active/`.
- When a concrete, implementable improvement is identified, may create the task directly as
  `status: approved` and implement it in the same session if the user's request already
  authorizes the work; otherwise leave it `draft` for user review.
- Works from task documents with `status: approved`.
- May have more than 10 active task documents available; when implementing, select and work in
  batches of at most 10 tasks at a time.
- Changes task status to `working` when implementation starts.
- Handles feature code changes, tests, commits, and pushes.
- Records implementation status, commit(s), push status, and validation results in the task
  document.
- Changes task status to `implemented` when implementation, validation, commit, and push are
  complete.
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

## Compact Task Document Template

Task documents should be concise by default. Include the required planning information, but
avoid repeating the same constraints across sections. Prefer short bullets over long prose.

Recommended structure:

```text
# TASK-###: Short Title

status: draft|approved|working|implemented|reviewed|done|blocked
created_by: claude-code
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
assignee: Claude Code
priority: low|medium|high
task_type: feature|improvement|bugfix

## 1. Goal
One short paragraph: user-visible problem, desired outcome, and why now.

## 2. Requirements
- In scope: 3-6 bullets.
- Out of scope: 2-5 bullets.
- Decision needed: omit when none; otherwise list only blocking questions.

## 3. Current Structure Analysis
- Docs reviewed: filenames only.
- Files reviewed: relevant filenames only.
- Current behavior: 3-6 bullets.

## 4. Design
- Backend/API: say "No change" when applicable.
- DB: say "No change" when applicable.
- Frontend: concrete UI/state/data-flow changes.
- Security impact: required when touching API inputs, auth, persistence, deletion, AI execution,
  exports, or external services.

## 5. Test Plan
- Backend tests: exact files/cases or "No backend change".
- Frontend/E2E tests: exact files/cases or manual validation.
- Security checks: only cases relevant to this task.

## 6. Claude Code Instructions
- Preserve unrelated changes.
- Implement only this task.
- Commit and push, then update status to implemented.

## 7. Completion Criteria
- 4-8 checkable bullets.

## 8. PR Review Checklist
- 4-8 review bullets focused on risk, behavior, and security.
```

Compression rules:

- Do not paste architecture background from `AGENTS.md`, `CLAUDE.md`, `README.md`, or ADRs into
  each task. List reviewed documents by filename and include only task-specific implications.
- Do not duplicate security notes in both Requirements and Security Impact. Put security details
  in `Design -> Security impact` and reference them from tests/checklists only when needed.
- Do not include API or DB tables when there is no API or DB change. Write `No change`.
- Keep Claude Code instructions standard and short unless the task has unusual constraints.
- Avoid broad implementation recipes. Include enough direction to preserve architecture, then
  inspect and implement.
- Target roughly 120-220 lines for normal improvement tasks. Only exceed that when the task
  spans multiple modules or has unresolved decisions.

Move tasks based on their state:

- `docs/tasks/active/`: draft, approved, working, implemented, or reviewed tasks
- `docs/tasks/done/`: tasks accepted as complete after user review of the relevant commit(s)
- `docs/tasks/blocked/`: tasks blocked by missing decisions, permissions, or external information

## Task State Flow

```text
draft -> approved -> working -> implemented -> reviewed -> done
                       |
                       v
                    blocked
```

State meanings:

- `draft`: planning draft, not yet approved for implementation
- `approved`: implementation approved by the user (or by Claude Code for concrete, low-risk,
  user-authorized improvement work)
- `working`: Claude Code is implementing
- `implemented`: implementation, validation, commit, and push are complete
- `reviewed`: user review is complete
- `done`: user has accepted the relevant commit(s) as complete
- `blocked`: progress is blocked by a decision, permission, or external dependency

## Approval Rules

- User-requested feature tasks may start as `draft` when product intent, scope, or tradeoffs
  need review.
- Claude Code may create a task directly as `status: approved` when it is concrete, low-risk,
  implementable without additional product decisions, and within the scope of what the user
  already asked for.
- Claude Code must not implement tasks that are `draft`, `blocked`, `reviewed`, or `done`.
- If scope changes or a decision is needed, move the task back to `draft` or mark it `blocked`
  before implementation continues.
- Claude Code should stop at `implemented`; `reviewed` and `done` are user-controlled states
  unless explicitly delegated.

## Branch Workflow

- Implement directly on `main` unless the user asks for a feature branch (e.g. for larger or
  higher-risk changes, where a short-lived feature branch merged back to `main` is preferred).
- Before starting a task, ensure the working tree is clean and up to date with the latest
  available remote state when safe.
- Implement, validate, commit, and push directly; a task does not need a separate merge step
  because it is already on `main` once pushed.
- A task may become `implemented` after implementation, validation, commit, and push are
  complete.
- The user controls `reviewed` and `done`; a task should become `done` only after the user
  reviews and accepts the relevant commit(s).
- Do not switch branches if the current worktree has unrelated uncommitted user or Claude Code
  changes. Preserve active work and ask for direction if needed.
- Do not push directly to `main` without it being clear the user wants that for the current
  unit of work (ask if unclear); do not force-push or rewrite shared history without explicit
  permission.

## Repository Architecture Rules

Check `CLAUDE.md`, `README.md`, and relevant `docs/adr/` documents before planning or
implementing work.

Core rules:

- Preserve the Modular Monolith architecture.
- Keep domain features under `app/modules/<domain>/`.
- Prefer service-layer communication between modules; avoid direct cross-module model/repository
  access.
- Keep `dashboard` as a read-only BFF aggregation module.
- Do not use SQLAlchemy async lazy loading.
- Load relationships explicitly with `selectinload` or `joinedload`.
- Services must not create their own DB sessions.
- Follow the `ai/service.py` transaction exception rules in `CLAUDE.md`.
- Follow existing frontend patterns in `frontend/lib/api.ts`, `frontend/types/index.ts`, and
  dashboard pages.

## Security Rules

- Treat security as a first-class requirement for every code improvement.
- Never read or print `.env` files.
- Never query or record API keys, DB passwords, JWT secrets, tokens, or other secrets.
- Do not ask the user for raw environment variable values.
- All DB queries must use parameter binding or ORM-safe query construction.
- Authentication, authorization, deletion, external integration, file handling, user input
  parsing, CSV/export, and AI action execution changes must include explicit security review
  notes in the task and implementation summary.
- Task documents must include a security impact section whenever the task touches API inputs,
  auth, persistence, deletion, AI execution, exports, or external services.
- Verify that implementation does not expose secrets, bypass auth, weaken authorization,
  introduce SQL injection risk, or leak internal exception details to users.
- API responses should not expose raw exception messages, stack traces, credentials, tokens,
  connection strings, or internal infrastructure details.
- If a security risk is unclear, mark the task as `blocked` or add `Decision Needed` instead of
  implementing by assumption.

## Work Principles

- Prioritize improvements that ensure existing site features work correctly end to end.
- Prioritize user convenience and day-to-day usability improvements for existing workflows.
- Prefer tasks that reduce user friction, improve validation, clarify error handling, prevent
  data loss, improve empty/loading/error states, preserve user progress, or make common
  workflows easier.
- Do not add features outside the requested scope.
- Do not propose or perform unnecessary refactors.
- Do not prioritize purely internal refactors unless they clearly improve feature correctness,
  usability, security, or testability.
- New features must include a test plan, including security-relevant cases when inputs, auth,
  deletion, exports, AI actions, or external services are involved.
- Ambiguous or risky points must be recorded as `Decision Needed` in the task document. Tasks
  with unresolved decisions should remain `draft` or become `blocked`, not `approved`.
- Respect existing code and documentation style.

### Preflight Check (filesystem — not memory)

Before any broad repository analysis, perform a filesystem inventory:

1. Read task files from `docs/tasks/active/`, `docs/tasks/done/`, and `docs/tasks/blocked/` as
   needed for status and duplicate detection.
2. Do not stop task creation solely because `docs/tasks/active/` contains 10 or more files.
3. Use task status and duplicate detection to decide whether a new task is useful and safe to
   create.

**Critical**: The authoritative task inventory comes from the filesystem only. Compacted
conversation context, chat history, or any cached summary must never be used as task inventory.
Stale memory may be read as background context but must never override what task files actually
contain. The task files themselves remain the source of truth.

### Duplicate Detection

Before creating a new task, verify the idea is not already present by inspecting:

- `docs/tasks/active/TASK-*.md` — includes draft, approved, working, implemented, and reviewed
  tasks
- `docs/tasks/done/TASK-*.md` — completed tasks
- `docs/tasks/blocked/TASK-*.md` — blocked tasks

Do not create a task if the same idea is found in any of those locations. Having 10 or more
files in `docs/tasks/active/` is not a duplicate and is not a reason to block new task creation.

### Content Rules

- Improvement tasks should primarily focus on existing feature correctness and usability.
- Concrete, low-risk improvement tasks may be created as `status: approved` when within the
  scope of what the user already asked for.
- Do not read `.env`, secret files, or credential-bearing paths during the preflight or analysis
  phase.

## Related Documents

- `CLAUDE.md`
- `README.md`
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-bff-pattern.md`
- `docs/adr/0003-sqlalchemy-async.md`
- `docs/harness-engineering.md`, `docs/harness-current-state.md`
