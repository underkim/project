# TASK-004: Local Goal Reset and Clearing

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

Allow users to clear or reset locally stored personal goal values across the dashboard, finance, growth, and health pages.

This improvement is needed because several pages currently persist user-entered goals in `localStorage`, but their save handlers only accept positive numbers. Once a goal is set, entering `0`, clearing the field, or intentionally removing the goal does not clear the stored value, so the old goal silently remains active.

## 2. Requirements

### In Scope

* Let users remove previously saved local goal values by clearing the input or saving `0` where the UX treats `0` as "no goal".
* Apply consistent behavior across goal-like local preferences used by:
  * finance asset goal
  * finance monthly budget
  * finance savings-rate goal
  * growth yearly book goal
  * growth monthly English goal
  * health weekly exercise goal
  * health nightly sleep goal
* Ensure dashboard summary cards immediately reflect cleared goals on the next render/load.
* Keep existing positive-value validation rules for real goal entries.
* Add focused validation coverage or frontend verification notes so the clearing behavior does not regress.

### Out of Scope

* Moving local goals to the backend
* Adding multi-device sync for goals
* Redesigning the finance, growth, health, or dashboard layouts
* Changing domain data models, APIs, or database schema

### Security Impact

This task only affects client-side `localStorage` preferences and does not change authenticated API inputs, persistence, auth, deletion, exports, AI execution, or external integrations.

Implementation must still ensure that:

* only expected numeric strings are written to `localStorage`
* cleared state does not produce `NaN`-driven rendering bugs
* no user-entered local preference value is interpolated into unsafe HTML

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`

### Relevant Files

* `frontend/app/(dashboard)/page.tsx`
* `frontend/app/(dashboard)/finance/page.tsx`
* `frontend/app/(dashboard)/growth/page.tsx`
* `frontend/app/(dashboard)/health/page.tsx`

### Observed Current Behavior

* Finance:
  * `saveGoal()` only saves when `v > 0`
  * `saveBudget()` only saves when `v > 0`
  * `saveSrGoal()` only saves when `v > 0 && v <= 100`
* Growth:
  * `saveGoal()` only saves when `v > 0`
  * `saveEngGoal()` only saves when `v > 0`
* Health:
  * `saveExGoal()` only saves when `v > 0 && v <= 7`
  * `saveSlGoal()` only saves when `v >= 1 && v <= 24`
* Each page initializes state from `localStorage`, defaulting to `0` when a key is absent.
* The dashboard overview page also reads the same keys and conditionally renders goal progress only when values are greater than `0`.

### Risk Summary

The current behavior creates a usability problem:

* users cannot intentionally remove a goal after setting it
* editing a goal to blank appears to succeed because edit mode closes, but the previous stored value remains
* dashboard progress indicators can continue showing stale goals that the user believes were cleared

## 4. Impact Scope

### Frontend

* `frontend/app/(dashboard)/finance/page.tsx`
  * support clearing local goal-like values
  * keep range validation for valid positive entries
* `frontend/app/(dashboard)/growth/page.tsx`
  * support clearing yearly and monthly goals
* `frontend/app/(dashboard)/health/page.tsx`
  * support clearing weekly and nightly goals
* `frontend/app/(dashboard)/page.tsx`
  * continue reading cleared keys as `0` / no goal state without stale display

### Backend

* No backend changes

### Database / Migration

* No schema changes
* No migration required

### Tests

* If the repo has an existing frontend test style for these pages, add narrow coverage for goal clearing.
* If not, add at least lightweight utility extraction coverage or document manual validation steps in the task implementation notes.

## 5. Design Decision

Treat blank input and explicit zero-equivalent submission as "clear this local goal" for pages whose UI already uses `0` to mean "goal not set".

### Chosen Approach

On save:

* parse the input
* if the field is blank, invalid, or intentionally `0` in a goal context, remove the corresponding `localStorage` key and set the React state to `0`
* if the value is a valid positive number within the existing range, persist it normally

This keeps current display logic compatible because the pages already interpret `0` as "no goal".

### Rejected Alternative 1

Keep the current save behavior and add separate "reset" buttons everywhere.

Reason:
This adds UI churn across multiple pages for a state model that can already represent "no goal" as `0`.

### Rejected Alternative 2

Auto-save invalid values as zero without removing the key.

Reason:
Removing the key is cleaner and keeps initialization semantics aligned with the current `getItem(...) ?? '0'` pattern.

## 6. API Design

* No API changes
* No request/response changes

## 7. DB Design

* No schema changes
* No relationship changes
* No migration required

## 8. Frontend Design

### Required UX Changes

* Saving an empty goal input should clear the previously stored goal.
* Saving `0` in goal editors that use zero as "off" should also clear the goal.
* After clearing, the UI should return to the same presentation used for an unset goal:
  * no progress bar for that goal
  * no stale target label
  * edit affordance still available
* Clearing should not show misleading success states that keep the old goal visible.

### UX Constraints

* Preserve the current compact inline editors.
* Do not add modals or large settings panels.
* If a tiny helper text or placeholder tweak is needed to communicate clearing behavior, keep it minimal.

## 9. Test Plan

### Frontend Validation

After implementation, validate these scenarios:

* Finance asset goal:
  * set a positive value
  * reopen editor and clear it
  * confirm the goal label/progress disappears
* Finance monthly budget and savings-rate goal:
  * repeat the same clear flow
* Growth book goal and English goal:
  * clear saved values and confirm dependent progress UI disappears
* Health exercise and sleep goals:
  * clear saved values and confirm summary widgets stop showing stale targets
* Dashboard overview:
  * after clearing the underlying local keys, confirm the top-level dashboard no longer shows stale goal progress for asset/book/English/CF metrics that depend on those keys

### Suggested Verification Commands

If frontend type checking exists:

```bash
cd frontend && npx tsc --noEmit
```

If page-level UI tests are added in the repo's existing style, keep them narrow and local-storage focused.

## 10. Claude Code Implementation Instructions

This task is already `status: approved`. Claude Code may implement it immediately.

### Branch Workflow

* Start from the latest `develop`.
* Create an implementation branch such as `fix/TASK-004-local-goal-reset-and-clearing`.
* After implementation and review, merge back into `develop`, not `main`.
* Do not switch branches if unrelated uncommitted work is present in the current worktree.

### Files To Edit

* `frontend/app/(dashboard)/finance/page.tsx`
* `frontend/app/(dashboard)/growth/page.tsx`
* `frontend/app/(dashboard)/health/page.tsx`
* `frontend/app/(dashboard)/page.tsx` only if a small read-path adjustment is needed

### Implementation Sequence

1. Re-read `CLAUDE.md`, `README.md`, and ADRs `0001` through `0003`.
2. Normalize the save handlers for local goals so blank or zero-equivalent input clears the corresponding key and sets state to `0`.
3. Preserve current positive-value range checks for valid goal input.
4. Confirm each page re-renders to the existing "goal not set" state after clearing.
5. Add the lightest useful regression coverage available in the repo's current frontend testing style, or document manual validation if no suitable test harness exists.

### Constraints

* Do not move these settings to backend persistence in this task.
* Do not redesign the page layouts.
* Do not change unrelated data-entry flows.

### Validation Commands

Document these after implementation, but do not run them during planning:

```bash
cd frontend && npx tsc --noEmit
```

If a suitable frontend test command already exists and the implementation adds tests, document that too.

## 11. Completion Criteria

* Previously saved local goals can be cleared intentionally.
* Clearing removes stale goal progress from the relevant page UI.
* Dashboard summary cards no longer reflect cleared goal keys.
* Positive-value validation still works for legitimate goal entries.
* No backend, database, or migration changes are introduced.

## 12. PR Review Checklist

* [ ] Finance goal, budget, and savings-rate editors can clear existing values
* [ ] Growth goal editors can clear existing values
* [ ] Health goal editors can clear existing values
* [ ] Dashboard overview no longer shows stale cleared goals
* [ ] Blank or zero-equivalent input does not leave hidden stale `localStorage` values behind
* [ ] Positive-value validation still blocks out-of-range values where required
* [ ] No backend/API/schema work was introduced
