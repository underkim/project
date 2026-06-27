# TASK-004: Dashboard Partial Failure Visibility

status: approved
type: improvement
priority: medium
created_by: codex
implemented_by:
reviewed_by:

created_at: 2026-06-28
approved_at: 2026-06-28
implemented_at:
reviewed_at:
merged_at:

branch:
pr:
merge_commit:

---

## 1. Goal

Make partial dashboard data failures visible to users without breaking the overview page.

This improvement is needed because the dashboard backend currently converts per-module failures into `None`, and the frontend renders those `None` values almost the same way it renders legitimate empty states. As a result, users can see `0`, `-`, or empty cards with no indication that one module failed to load.

## 2. Requirements

### In Scope

* Preserve the current dashboard behavior where one module failure does not take down the full overview page.
* Distinguish "module has no data yet" from "module snapshot failed to load" in the dashboard API response.
* Surface partial failure state in the dashboard UI with clear but lightweight messaging.
* Add server-side logging for dashboard snapshot failures instead of silently swallowing them.
* Keep existing overview cards navigable even when a module snapshot fails.
* Add regression tests for backend partial-failure metadata and frontend degraded-state rendering.

### Out of Scope

* Redesigning the dashboard layout or card hierarchy
* Changing detail-page APIs for finance, health, growth, career, planner, or travel
* Adding retry queues, background jobs, or telemetry infrastructure
* Global exception-handling refactors outside the dashboard module

### Security Impact

This task touches authenticated API responses. The implementation must ensure that:

* failure metadata does not expose raw exception text, stack traces, connection details, or internal service names beyond the already-visible module identifiers
* server-side logs retain diagnostic detail while API responses remain sanitized
* the dashboard continues to return only user-safe summary information

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`

### Relevant Files

* `app/modules/dashboard/service.py`
* `app/modules/dashboard/router.py`
* `app/modules/dashboard/schemas.py`
* `frontend/app/(dashboard)/page.tsx`
* `frontend/types/index.ts`
* `tests/test_dashboard.py`
* `frontend/e2e/dashboard.spec.ts`

### Observed Current Behavior

* Each dashboard snapshot helper catches broad exceptions and returns `None`.
* `get_overview()` also uses `asyncio.gather(..., return_exceptions=True)` and converts any remaining exception result to `None`.
* `OverviewResponse` has only nullable module snapshots, so the client cannot tell why a module is `null`.
* The dashboard page falls back to neutral display values such as `0`, `-`, `없음`, or hidden sections when module data is missing.
* Current tests verify that overview data loads, but they do not verify degraded-state metadata or degraded-state UI behavior.

### Risk Summary

The current implementation creates a usability and supportability gap:

* users cannot tell whether data is genuinely empty or temporarily unavailable
* partial backend failures can remain unnoticed on the home screen
* maintainers lose an easy signal for overview regressions because failures are intentionally suppressed

## 4. Impact Scope

### Backend

* `app/modules/dashboard/schemas.py`
  * extend the overview response with safe per-module load status metadata
* `app/modules/dashboard/service.py`
  * log snapshot failures
  * return structured degraded-state metadata instead of only `None`
* `app/modules/dashboard/router.py`
  * keep the existing endpoint contract path while serving the enriched response model

### Frontend

* `frontend/types/index.ts`
  * add the new dashboard status metadata types
* `frontend/app/(dashboard)/page.tsx`
  * show a compact warning banner or inline card state when one or more modules failed
  * keep current navigation and summary layout intact

### Database / Migration

* No schema changes
* No migration required

### Tests

* `tests/test_dashboard.py`
  * add API tests for partial-failure metadata
* `frontend/e2e/dashboard.spec.ts`
  * add a focused degraded-state UI scenario if the existing frontend test style supports mocked failures cleanly

## 5. Design Decision

Keep ADR-0002's partial-success dashboard strategy, but make degradation explicit through sanitized module status metadata.

### Chosen Approach

Add a top-level dashboard metadata object that records which modules loaded successfully and which failed, while preserving nullable snapshot fields for backwards compatibility.

Suggested shape:

```json
{
  "planner": null,
  "finance": { "...": "..." },
  "health": { "...": "..." },
  "growth": { "...": "..." },
  "career": { "...": "..." },
  "travel": { "...": "..." },
  "meta": {
    "degraded_modules": ["planner"],
    "module_status": {
      "planner": "error",
      "finance": "ok",
      "health": "ok",
      "growth": "ok",
      "career": "ok",
      "travel": "ok"
    }
  }
}
```

The exact field names can be adjusted, but the response must let the frontend distinguish:

* snapshot missing because of failure
* snapshot present with zero or empty values

### Rejected Alternative 1

Continue using nullable snapshots only and infer failure from missing data in the UI.

Reason:
This remains ambiguous because empty or unconfigured states are valid for multiple modules.

### Rejected Alternative 2

Fail the entire overview endpoint when any module snapshot fails.

Reason:
This would violate the existing BFF partial-success intent documented in ADR-0002 and would create a worse user experience.

## 6. API Design

### Endpoint

* `GET /api/v1/dashboard/overview`

### Response Change

* Keep existing module snapshot fields.
* Add a new safe metadata block describing per-module status.

### Response Rules

* module snapshot success -> existing snapshot payload remains populated
* module snapshot failure -> module field may remain `null`, but metadata must mark it as failed
* unexpected internal failures must not include raw exception text in the response

### Example Safe Failure Metadata

```json
{
  "meta": {
    "degraded_modules": ["travel", "career"],
    "module_status": {
      "planner": "ok",
      "finance": "ok",
      "health": "ok",
      "growth": "ok",
      "career": "error",
      "travel": "error"
    }
  }
}
```

## 7. DB Design

* No schema changes
* No relationship changes
* No migration required

## 8. Frontend Design

The dashboard should remain usable, but it must no longer silently mask degraded data.

### Required UX Changes

* Show a compact overview-level warning when one or more modules failed to load.
* Mark affected cards with a clear unavailable state such as:
  * `일시적으로 불러오지 못했습니다.`
  * a muted warning badge
  * a retry hint only if implemented without layout churn
* Keep unaffected module cards unchanged.
* Do not replace a failed module with misleading zeros that look like real summary data.

### UX Constraints

* Preserve the current dashboard visual language and card structure.
* Avoid a blocking modal or full-page error for partial failures.
* Keep Korean UI copy aligned with the existing app tone.

## 9. Test Plan

### Backend Tests

Add or update tests in `tests/test_dashboard.py` to cover:

* one snapshot helper raising an exception still returns `200`
* the failed module is flagged in response metadata
* unaffected modules remain populated
* raw exception text is not exposed in the response body

Suggested implementation style:

* patch one dashboard snapshot helper to raise `RuntimeError("database connection detail")`
* assert that the response contains sanitized degraded metadata, not the raw text

### Frontend Validation

If frontend tests are extended:

* simulate an overview response where one module snapshot is `null` and metadata marks it as failed
* verify the dashboard renders a visible degraded-state message
* verify unaffected cards still render normally

If the repo's current frontend test setup makes this heavy, a manual validation note is acceptable, but the backend regression test is required.

## 10. Claude Code Implementation Instructions

This task is already `status: approved`. Claude Code may implement it immediately.

### Branch Workflow

* Start from the latest `develop`.
* Create an implementation branch such as `fix/TASK-004-dashboard-partial-failure-visibility`.
* After implementation and review, merge back into `develop`, not `main`.
* Do not switch branches if unrelated uncommitted work is present in the current worktree.

### Files To Edit

* `app/modules/dashboard/schemas.py`
* `app/modules/dashboard/service.py`
* `app/modules/dashboard/router.py` if needed for model updates
* `frontend/types/index.ts`
* `frontend/app/(dashboard)/page.tsx`
* `tests/test_dashboard.py`
* optionally `frontend/e2e/dashboard.spec.ts`

### Implementation Sequence

1. Re-read `CLAUDE.md`, `README.md`, and ADRs `0001` through `0003`.
2. Add safe dashboard response metadata for per-module load status.
3. Update dashboard snapshot helpers to log failures with `logger.exception(...)` or an equivalent structured logger call.
4. Preserve partial-success behavior for unaffected modules.
5. Update frontend types and the dashboard page to display degraded-state messaging for failed modules.
6. Add backend regression tests for sanitized degraded-state metadata.
7. Add or update frontend verification only if it can be done narrowly without introducing brittle test scaffolding.

### Constraints

* Do not change other module APIs in this task.
* Do not expose raw exception text in API responses.
* Do not turn partial module failure into a full endpoint failure.
* Do not redesign the entire dashboard page.

### Validation Commands

Document these after implementation, but do not run them during planning:

```bash
uv run pytest tests/test_dashboard.py
```

If frontend tests are added or touched:

```bash
cd frontend && npx playwright test e2e/dashboard.spec.ts
```

## 11. Completion Criteria

* The dashboard overview response distinguishes failed module snapshots from legitimate empty states.
* Partial module failures remain non-blocking for the rest of the overview.
* The dashboard UI visibly communicates degraded modules to the user.
* Failed dashboard responses do not leak raw exception text.
* Backend regression tests cover degraded metadata behavior.
* No database or migration changes are introduced.

## 12. PR Review Checklist

* [ ] Partial dashboard failures still return `200` when unaffected modules can load
* [ ] The API now exposes safe per-module degraded-state metadata
* [ ] Raw exception text is not returned in the overview response
* [ ] Dashboard UI distinguishes failed modules from true empty states
* [ ] Unaffected cards remain usable and visually stable
* [ ] Server-side logging captures the original failure detail
* [ ] No unrelated module API contracts were changed
* [ ] No schema or migration work was introduced
