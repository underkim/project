# TASK-008: Travel Trip Date Editing

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28

branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Allow users to edit an existing trip's `start_date` and `end_date` from the travel page so date corrections do not require deleting and recreating the whole trip.

This is a concrete usability gap in an existing workflow. The backend already supports date updates on `PUT /api/v1/travel/trips/{trip_id}`, and travel schema validation already rejects invalid date ranges, but the current travel edit UI only exposes `name`, `destination`, `status`, and `note`. After a user saves a trip with the wrong dates, there is no frontend path to correct those dates while preserving its checklist and plan items.

## 2. Requirements

### In Scope

* Add editable `start_date` and `end_date` inputs to the existing travel trip edit UI.
* Submit date changes through the existing `travelApi.updateTrip()` call.
* Keep the current edit flow inline inside each trip card.
* Prevent obviously invalid date selections in the UI by keeping `end_date` aligned with `start_date` constraints.
* Preserve existing trip fields and current response shapes.
* Surface failed date updates with the existing toast/error pattern used on the travel page.
* Add or update focused verification coverage for editing a trip date range.

### Out of Scope

* Changing travel backend routes, response schemas, or persistence structure.
* Changing travel plan item validation rules beyond what already exists.
* Reworking travel card layout outside the minimal UI changes needed for inline date editing.
* Adding bulk edit, drag-and-drop itinerary editing, or new date-derived travel features.

## 3. Current Structure Analysis

* [`frontend/app/(dashboard)/travel/page.tsx`](C:/Users/rlaeh/Desktop/FastAPI/project/frontend/app/(dashboard)/travel/page.tsx) uses `TripCard` for inline trip editing.
* `AddTripForm` already supports `start_date` and `end_date` during trip creation.
* `TripCard` edit mode currently tracks `editName`, `editDest`, `editStatus`, and `editNote`, but not editable date state.
* `saveEdit()` calls `onUpdate(trip.id, { ... })`, and the current payload omits trip dates even though the API client supports them.
* [`frontend/lib/api.ts`](C:/Users/rlaeh/Desktop/FastAPI/project/frontend/lib/api.ts) already defines `travelApi.updateTrip()` with `start_date` and `end_date` in the accepted payload type.
* [`app/modules/travel/router.py`](C:/Users/rlaeh/Desktop/FastAPI/project/app/modules/travel/router.py) and [`app/modules/travel/service.py`](C:/Users/rlaeh/Desktop/FastAPI/project/app/modules/travel/service.py) already support `PUT /api/v1/travel/trips/{trip_id}` updates for both date fields.
* [`app/modules/travel/schemas.py`](C:/Users/rlaeh/Desktop/FastAPI/project/app/modules/travel/schemas.py) already validates:
  * create: `end_date >= start_date`
  * update when both dates are provided together: `end_date >= start_date`
* [`tests/test_travel.py`](C:/Users/rlaeh/Desktop/FastAPI/project/tests/test_travel.py) already covers backend validation for invalid travel date ranges, but there is no frontend coverage for editing trip dates from the existing UI.

## 4. Impact Scope

### Frontend

* Travel trip inline edit state in `TripCard`
* Travel save payload construction
* Inline edit form layout and input constraints
* Optional focused Playwright coverage for the travel page

### Backend

* No API contract change expected
* No router/service behavior change required unless Claude finds a frontend-triggered validation gap during implementation review

### Tests

* Frontend E2E coverage is the preferred regression layer for this task
* Backend tests should remain unchanged unless a real contract mismatch is discovered

## 5. Design Decision

Use the existing inline edit card and extend it with two date inputs rather than introducing a separate edit modal or a new detail page.

Reasoning:

* The travel page already supports inline trip editing and creation with date controls.
* Reusing the existing card-level edit flow minimizes scope and keeps the change consistent with current UX patterns.
* Adding date inputs to the same form completes the existing editing capability without introducing a new navigation pattern.

## 6. API Design

No new API endpoint is needed.

Continue using:

* `PUT /api/v1/travel/trips/{trip_id}`

Expected request usage after this task:

* Send `start_date` and `end_date` when the user edits either date.
* Continue allowing partial payloads for unchanged fields.

No response shape changes are expected.

## 7. DB Design

No database schema or migration change is needed.

Existing `Trip.start_date` and `Trip.end_date` columns remain the source of truth.

## 8. Frontend Design

Update the trip card edit mode so it matches the trip creation form more closely:

* Add local edit state for `editStartDate` and `editEndDate`.
* Render `type="date"` inputs in edit mode.
* When `start_date` moves after the current `end_date`, immediately clamp `editEndDate` to the new `editStartDate`.
* Set the `min` attribute on the end-date input to the current edited start date.
* Include both dates in the save payload.
* Preserve existing save/cancel controls and toast-based mutation feedback.

If layout pressure appears on smaller screens, prefer stacking the date inputs within the existing grid instead of widening the card or introducing a modal.

## 9. Security Impact

This task touches API input submission for an authenticated route, so keep the following explicit review points:

* Do not loosen existing auth behavior for travel routes.
* Do not bypass server-side validation by trusting frontend date constraints alone.
* Do not expose raw backend exception text beyond the existing sanitized error handling patterns.
* Keep requests limited to safe date string fields already accepted by the travel API.

Security risk is low because the change reuses an existing authenticated endpoint and existing validated fields.

## 10. Test Plan

### Frontend Verification

* Edit an existing trip and change both `start_date` and `end_date`; verify the updated range is shown after save.
* Change `start_date` forward past the current `end_date`; verify the UI prevents or auto-corrects an invalid range before submission.
* Verify existing trip metadata and nested checklist/plan items remain intact after a date-only edit.
* Verify failed update responses still surface visible feedback to the user.

### Suggested E2E Coverage

* Add or extend a Playwright travel scenario that:
  * creates a trip
  * opens inline edit mode
  * updates trip dates
  * confirms the new range is rendered after save

### Backend Coverage

* Existing backend date validation coverage in `tests/test_travel.py` should remain sufficient unless implementation exposes a real mismatch.

## 11. Claude Code Implementation Instructions

Implement this task directly on `develop`. Do not create a new task branch.

Expected implementation steps:

1. Extend the travel trip edit form in [`frontend/app/(dashboard)/travel/page.tsx`](C:/Users/rlaeh/Desktop/FastAPI/project/frontend/app/(dashboard)/travel/page.tsx) to manage editable `start_date` and `end_date` state.
2. Include the date fields in the existing `onUpdate` save payload.
3. Add minimal client-side guardrails so the end date cannot fall before the chosen start date.
4. Add or update focused frontend regression coverage for the edited trip date flow.
5. Validate locally as appropriate without changing backend contracts.
6. Commit to `develop`, push `develop`, and then update this task file to `implemented` with validation and commit details.

## 12. Completion Criteria

* Users can edit trip start and end dates from the existing travel card edit UI.
* Saved date changes persist through the existing travel update API.
* Invalid client-side date ranges are prevented or corrected before submission.
* Existing travel edit behavior for name, destination, status, and note remains intact.
* Relevant regression coverage or documented validation evidence is added.
* Claude Code updates this task to `implemented` only after implementation, validation, commit, and push to `develop` are complete.

## 구현 결과

### 변경 파일
* `frontend/app/(dashboard)/travel/page.tsx` — TripCard에 `editStartDate`/`editEndDate` state + date inputs + 클램프 로직 + saveEdit payload 포함
* `frontend/e2e/travel.spec.ts` — 날짜 편집 저장 및 클램프 동작 E2E 테스트 (신규)

### 구현 요약
* `editStartDate`/`editEndDate` state를 `trip.start_date`/`trip.end_date`로 초기화
* 편집 폼 grid에 두 개의 `type="date"` input 추가
* 시작일 변경 시 새 시작일 > 현재 종료일이면 종료일을 시작일로 자동 클램프
* 종료일 input에 `min={editStartDate}` 속성으로 브라우저 기본 제한 추가
* `saveEdit()`: 기존 name/destination/status/note에 `start_date`/`end_date` 추가 포함

### 테스트 결과
* TypeScript: 오류 없음 (exit 0)
* E2E: live 서버 필요로 미실행. 날짜 편집 저장·클램프 2개 케이스 추가

### 커밋
`eb95cb4` — develop 직접 커밋 + push (PR 없음)

## 13. PR Review Checklist

* Confirm trip date inputs appear only in edit mode and use the existing visual pattern.
* Confirm saved trip dates re-render correctly in the collapsed card summary.
* Confirm the save payload includes `start_date` and `end_date` when edited.
* Confirm invalid date ranges are blocked in the UI and still rejected safely server-side if bypassed.
* Confirm no backend route, schema, or DB changes were introduced unnecessarily.
* Confirm checklist items and plan items still remain attached to the same trip after date edits.
