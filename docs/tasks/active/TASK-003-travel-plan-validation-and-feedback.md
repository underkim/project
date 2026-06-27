# TASK-003: Travel Plan Validation and Mutation Feedback

status: approved
type: improvement
priority: medium
created_by: codex
implemented_by:
reviewed_by:

created_at: 2026-06-28
approved_at:
implemented_at:
reviewed_at:
merged_at:

branch:
pr:
merge_commit:

---

## 1. Goal

Prevent invalid travel itinerary data from being saved and make failed travel mutations visible to users without losing their in-progress input.

This improvement is needed because the current travel API accepts itinerary `day` values that are only checked for positivity, not for whether they fit within the trip date range, and the travel page currently swallows some checklist/plan mutation failures silently.

## 2. Requirements

### In Scope

* Validate travel plan item writes against the owning trip duration.
* Reject invalid `day` values for both:
  * `POST /api/v1/travel/trips/{trip_id}/plan`
  * `PUT /api/v1/travel/plan/{item_id}`
* Add schema-level validation for `PlanItemUpdate` so partial updates cannot set:
  * empty `title`
  * non-positive `day`
* Keep current trip and plan response shapes unchanged.
* Surface travel mutation failures to users on the frontend using the existing toast pattern instead of silent failure paths.
* Preserve the user’s unsaved checklist/plan draft input when a request fails.
* Add backend and frontend-oriented tests that lock in the validation and feedback behavior.

### Out of Scope

* Redesigning the travel page layout
* Adding plan item reordering, drag-and-drop, or bulk editing
* Changing travel table schema or adding migrations
* Reworking unrelated modules to use a shared form library
* Expanding validation to AI-generated travel actions in this task

### Security Impact

This task touches authenticated API inputs and persistence. The implementation must ensure that:

* invalid itinerary input is rejected server-side even if a client bypasses the UI
* the API returns user-safe validation details without leaking internals
* authenticated users cannot persist out-of-range travel plan data that breaks downstream reads or exports
* frontend error handling does not suppress important failure states during destructive or mutating actions

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`
* `docs/architecture/system.md`
* `docs/architecture/data-model.md`

### Relevant Files

* `app/modules/travel/schemas.py`
* `app/modules/travel/service.py`
* `app/modules/travel/router.py`
* `app/modules/travel/models.py`
* `frontend/app/(dashboard)/travel/page.tsx`
* `frontend/lib/toast.ts`
* `tests/test_travel.py`

### Observed Current Behavior

* `PlanItemCreate` validates only `day >= 1` and non-empty `title`.
* `PlanItemUpdate` currently has no validators for `title` or `day`.
* `service.add_plan_item()` loads the trip but does not verify that `data.day` fits within the trip’s inclusive date range.
* `service.update_plan_item()` updates the plan item directly without checking:
  * whether the new `day` is still within the trip duration
  * whether an updated `title` is blank after trimming
* The travel UI constrains new/editable plan days through a `<select>` built from `tripDays`, but that protection exists only in the page.
* `frontend/app/(dashboard)/travel/page.tsx` currently has mutation paths that catch and ignore errors for:
  * `handleAddChecklist`
  * `handleAddPlanItem`
* Other travel mutations often recover with `await load()` but do not consistently tell the user what failed.

### Risk Summary

The current behavior creates two concrete risks:

* data correctness risk: invalid `day` values can be persisted through direct API calls or future client regressions
* usability risk: users can attempt a checklist or plan change, receive no visible feedback, and be left unsure whether data was saved

## 4. Impact Scope

### Backend

* `app/modules/travel/schemas.py`
  * add missing validation for `PlanItemUpdate`
* `app/modules/travel/service.py`
  * centralize trip-duration validation for plan item writes
  * enforce the same rule on create and update paths
* `app/modules/travel/router.py`
  * convert travel validation failures into stable `422` responses where needed

### Frontend

* `frontend/app/(dashboard)/travel/page.tsx`
  * replace silent mutation failures with visible toast feedback
  * keep local draft values intact when add/update calls fail
  * align travel-page mutation UX with finance/health/growth pages that already use toasts

### Database / Migration

* No schema changes
* No migration required
* No seed updates required

### Tests

* `tests/test_travel.py`
  * add API coverage for out-of-range plan day validation on create and update
  * add API coverage for blank plan title rejection on update
* If the implementation adds frontend component tests in the repo’s existing style, keep them focused on visible error handling and draft preservation

## 5. Design Decision

Enforce trip-plan boundary rules in the travel backend and treat frontend controls as convenience, not as the source of truth.

### Chosen Approach

* Add a small travel-service validation helper that computes the inclusive trip length from `start_date` and `end_date`.
* Reuse that helper from both plan create and plan update flows.
* Keep `422` as the validation failure status so the client can distinguish user-correctable input errors from load/retry failures.
* Use the existing toast system on the travel page for failed mutations and avoid clearing the user’s typed draft unless the request succeeds.

### Rejected Alternative 1

Rely on the frontend day selector alone.

Reason:
This does not protect API integrity and can be bypassed by direct clients, AI-generated requests, or future frontend regressions.

### Rejected Alternative 2

Add a database constraint for trip-relative plan day range.

Reason:
The valid maximum depends on each trip’s date range, so enforcing it at the relational schema layer would be awkward and unnecessary for this narrow improvement.

## 6. API Design

No endpoint paths or success payloads change.

### Endpoints

| Method | Path | Change |
| ------ | ---- | ------ |
| POST | `/api/v1/travel/trips/{trip_id}/plan` | Reject `day` values outside the trip duration with `422` |
| PUT | `/api/v1/travel/plan/{item_id}` | Reject out-of-range `day` and blank `title` updates with `422` |

### Validation Rules

* `day` must remain `>= 1`
* `day` must be `<=` inclusive trip length in days
* updated `title`, when provided, must be non-empty after trimming

### Expected Error Behavior

* missing trip: `404`
* missing plan item: `404`
* invalid plan input: `422`
* unchanged valid requests: current `200` / `201` behavior

### Example Validation Response

```json
{"detail":"Plan day must be within the trip duration."}
```

The final message text can be adjusted, but it should stay explicit, user-correctable, and free of internal implementation details.

## 7. DB Design

* No new columns
* No new constraints
* No index changes
* No migration required

Application-layer validation is sufficient because the rule depends on the related trip’s date range.

## 8. Frontend Design

The travel page should match the repo’s existing mutation UX patterns.

### Required UX Changes

* Show an error toast when checklist or plan item creation fails.
* Show an error toast when optimistic delete/toggle/update operations fail and the page reload is used to recover state.
* Preserve typed but unsaved checklist text and unsaved plan form values when the request fails.
* Show success toasts only where they improve clarity without becoming noisy; at minimum, failed mutations must no longer be silent.

### Interaction Notes

* The existing plan day `<select>` should remain, because it reduces invalid input before submission.
* Backend validation still must remain authoritative.
* Travel-page messaging should continue using the current Korean UX tone in the UI, while task documentation stays in English.

## 9. Test Plan

### Backend Tests

Add or update tests in `tests/test_travel.py` to cover:

* creating a plan item with `day` greater than trip length returns `422`
* updating a plan item to a `day` greater than trip length returns `422`
* updating a plan item with `day=0` returns `422`
* updating a plan item with blank `title` returns `422`
* valid create and update flows continue to succeed

Suggested scenarios:

* trip from `2026-11-01` to `2026-11-03` accepts `day=1..3`
* the same trip rejects `day=4`

### Frontend Validation

After implementation, validate manually or with existing frontend test style that:

* failed checklist creation displays an error toast
* failed plan item creation displays an error toast
* typed checklist text remains in the input after a failed request
* typed plan title/time/description remain in the form after a failed request

Do not introduce brittle UI tests that depend on exact animation timing.

## 10. Claude Code Implementation Instructions

This task is already `status: approved`. Claude Code may implement it immediately.

### Files To Edit

* `app/modules/travel/schemas.py`
* `app/modules/travel/service.py`
* `app/modules/travel/router.py`
* `frontend/app/(dashboard)/travel/page.tsx`
* `tests/test_travel.py`

### Implementation Sequence

1. Re-read `CLAUDE.md`, `README.md`, and ADRs `0001` through `0003`.
2. Add `PlanItemUpdate` validators for trimmed non-empty titles and positive day values.
3. Add a small travel-service helper that computes inclusive trip duration and validates requested plan day bounds.
4. Apply that validation in both `add_plan_item()` and `update_plan_item()`.
5. Ensure validation failures surface as `422` instead of generic `500`.
6. Update the travel page to use `showToast(...)` for failed mutations that are currently silent or opaque.
7. Preserve draft form state on failed checklist/plan creation instead of clearing inputs before success.
8. Add regression tests in `tests/test_travel.py`.

### Constraints

* Do not modify migrations or database schema.
* Do not broaden this into a full travel-page redesign.
* Do not replace existing travel API response models.
* Keep modular-monolith boundaries intact inside `app/modules/travel/`.

### Validation Commands

Document these after implementation, but do not run them during planning:

```bash
uv run pytest tests/test_travel.py
```

If the implementation touches shared frontend typing or behavior and needs broader confidence:

```bash
uv run pytest
cd frontend && npm run typecheck
```

## 11. Completion Criteria

* Travel plan item creation rejects `day` values outside the owning trip duration.
* Travel plan item updates reject out-of-range `day` values and blank titles.
* Validation failures return `422` with safe, user-correctable detail messages.
* Travel checklist/plan mutation failures are no longer silent in the UI.
* Failed travel create/update actions preserve the user’s unsaved draft input.
* No schema or migration changes are introduced.

## 12. PR Review Checklist

* [ ] Server-side validation enforces trip-relative plan day bounds on both create and update
* [ ] `PlanItemUpdate` no longer accepts blank titles or invalid day values
* [ ] Travel API validation failures return `422`, not silent corruption or `500`
* [ ] Travel checklist and plan mutation failures produce visible user feedback
* [ ] Failed travel mutations preserve unsaved local input where practical
* [ ] No migration, schema change, or unrelated refactor was introduced
* [ ] Security review confirms API input validation remains authoritative on the server
