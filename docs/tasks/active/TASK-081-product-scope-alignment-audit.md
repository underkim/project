# TASK-081: Product Scope Alignment Audit

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Align Life Dashboard with a clear product purpose before removing or adding features. Preserve the
five-year roadmap and daily life-management core, identify internal or overly personal features,
and define a smaller first implementation batch that improves everyday usefulness without losing
existing user data.

## 2. Requirements

### In scope

- Classify current pages and backend modules as core, supporting, internal-only, or product-decision
  candidates.
- Confirm whether the product is a single-user personal dashboard or a reusable general-purpose
  dashboard.
- Hide or remove features only after their data ownership, API, export, AI, dashboard, and navigation
  dependencies are mapped.
- Prefer reversible UI hiding before destructive API, table, or migration removal.
- Select the first addition from concrete daily workflow gaps rather than adding another isolated
  tracker.
- Split approved removals and additions into separately testable implementation tasks.

### Out of scope

- Immediate database table deletion or destructive migration.
- Broad visual redesign unrelated to the selected product scope.
- Replacing the modular monolith or dashboard BFF architecture.
- Adding social, team, or multi-tenant behavior without a separate product decision.

### Decision needed

- Resolved: target a general-purpose service where users configure their own tracking areas.
- Resolved: remove Dev Status completely from the shipped application.
- Resolved: replace fixed Career/Growth navigation with configurable trackers while preserving old
  tables until data migration or retirement is separately approved.
- Resolved: prioritize a simple release-ready tracking workflow before external calendar integration.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `0001-modular-monolith.md`,
  `0002-bff-pattern.md`, `0003-sqlalchemy-async.md`.
- Files reviewed: `app/main.py`, `frontend/components/Sidebar.tsx`, dashboard page files, module
  routers, and task inventories under `docs/tasks/`.
- Planner is the product anchor: a five-year roadmap with phases, categories, items, and deadlines.
- Finance, Health, Growth, Career, and Travel are independent CRUD trackers surfaced through a
  read-only dashboard aggregation API.
- AI reads across the domain data and can create, update, or delete records with confirmation flows.
- Export supports Finance, Health, Growth, Career, and Travel data.
- Dev Status reads repository task/activity files and is conditionally exposed by backend settings,
  but its frontend navigation entry is always visible.
- Growth is fixed to books and English logs; Career is fixed to Codeforces ratings and settings.
- Existing active tasks already cover reliability, accessibility, validation, export safety, and
  loading states; this audit must not duplicate those tasks.
- The filesystem currently contains duplicated task filenames across `active` and `done`; cleanup is
  tracked separately and should not be mixed with product scope changes.

## 4. Design

### Backend/API

- No change during the audit.
- For approved removals, first stop dashboard, AI, export, and frontend consumption; retain APIs for a
  defined compatibility window unless the user explicitly approves full removal.
- For additions, keep the new domain under `app/modules/<domain>/` and expose summaries through the
  dashboard service layer only.

### DB

- No change during the audit.
- Any later table retirement requires an export/data-retention decision and a reversible migration
  plan before destructive cleanup.

### Frontend

- Core: Dashboard, Planner, authentication, and contextual AI assistance.
- Supporting: Finance, Health, Travel, export, and Help, subject to actual usage confirmation.
- Internal-only candidate: Dev Status.
- Product-decision candidates: Codeforces-specific Career and books/English-specific Growth.
- Recommended first addition candidate: a unified action layer for tasks/habits tied to roadmap goals,
  because it connects long-term planning to daily execution instead of creating another data silo.

### Security impact

- Removing UI navigation does not authorize removing API authorization or exposing previously hidden
  endpoints.
- Data-bearing feature removal must preserve authenticated export or another approved recovery path
  before records are deleted.
- Any calendar integration requires a separate external-service and token-storage security review.
- Configurable tracker inputs must remain length-bounded and validated; no user-provided field may be
  treated as executable code or an unrestricted database identifier.

## 5. Test Plan

- Backend tests: No backend change for the audit. Later tasks must cover retired endpoint behavior,
  dashboard partial aggregation, AI action allowlists, export retention, and authorization.
- Frontend/E2E tests: verify navigation visibility, direct-route behavior, dashboard cards, AI refresh,
  empty states, and retained feature access for each approved scope change.
- Security checks: verify hidden modules remain authenticated, removed data is not leaked through the
  dashboard/AI/export paths, and destructive migrations are not introduced without explicit approval.

## 6. Claude Code Instructions

- Preserve unrelated changes.
- Implement only user-approved removal/addition tasks derived from this audit.
- For implementation tasks, commit and push, then update status to implemented.

## 7. Completion Criteria

- The target product audience and level of personalization are explicitly decided.
- Every current module has a core/supporting/internal/decision classification.
- The first removal batch identifies all frontend, API, DB, dashboard, AI, export, and test impacts.
- The first addition has a clear daily workflow and does not duplicate an existing module.
- Data retention and rollback behavior are defined for every removal.
- Separate approved task documents exist for the selected removal and addition batches.

## 8. PR Review Checklist

- Confirm no user data is deleted merely because a navigation item is hidden.
- Confirm dashboard aggregation remains read-only and tolerates retired modules.
- Confirm AI action and context mappings match the visible product scope.
- Confirm exports remain available for retained historical data.
- Confirm internal tools are not accidentally exposed to ordinary users.
- Confirm the addition supports the roadmap-to-daily-action product goal.
- Confirm unrelated reliability tasks are not duplicated or bundled.

## 9. Implementation Result

- Product direction confirmed as a general-purpose configurable service.
- Dev Status was removed and fixed Growth/Career navigation was replaced by configurable trackers.
- Implementation commit: `efaad30` plus the final status/usability follow-up commit.
- Validation: 393 backend tests, frontend lint, typecheck, and production build passed.
