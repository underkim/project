# TASK-004: Local Goal Reset and Clearing

status: implemented
type: improvement
priority: medium
created_by: codex
implemented_by: claude
reviewed_by:

created_at: 2026-06-28
approved_at: 2026-06-28
implemented_at: 2026-06-28
reviewed_at:
merged_at:

branch: fix/TASK-004-local-goal-reset-and-clearing
pr: (gh CLI 미설치 — GitHub 웹에서 PR 생성 필요, base: develop)
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

## 구현 결과

### 변경 파일

* `frontend/app/(dashboard)/finance/page.tsx` — `saveGoal`·`saveBudget`·`saveSrGoal` 빈/0/무효 입력 시 키 제거 + state 0
* `frontend/app/(dashboard)/growth/page.tsx` — `saveGoal`·`saveEngGoal` 동일 적용
* `frontend/app/(dashboard)/health/page.tsx` — `saveExGoal`·`saveSlGoal` 동일 적용 (범위 검증 유지)
* `frontend/e2e/finance.spec.ts` — 자산 목표 clear 플로우 e2e 테스트 추가

### 구현 요약

* 모든 로컬 목표 save 핸들러를 정규화: `Number.isNaN(v) || v <= 0`이면 `localStorage.removeItem(key)` + state `0`, 유효 양수(기존 범위 내)면 정상 저장.
* 상한이 있는 항목(저축률 ≤100, 운동 ≤7, 수면 1~24)은 범위 초과 시 저장하지 않고 기존 값 유지 — 기존 범위 검증 보존.
* dashboard `page.tsx`는 `getItem(...) ?? '0'` 패턴이라 키 제거 시 자동으로 `0`(목표 없음)으로 읽혀 read-path 변경 불필요.
* 모든 목표 에디터는 zero를 "목표 없음"으로 해석하므로 기존 표시 로직과 호환.

### 추가/수정한 테스트

* `frontend/e2e/finance.spec.ts`: "자산 목표를 비우고 저장하면 목표가 제거된다" — localStorage 주입 → 입력 비우고 Enter → "목표 설정" 복귀 + 키 null 확인

### 실행한 검증 명령

```
cd frontend && npx tsc --noEmit
```

### 테스트 결과

* TypeScript: 오류 없음 (exit 0)
* e2e(`npm run e2e`)는 live 백엔드+프론트 서버 필요 — 이 환경에서 미실행. 추가한 finance 목표 clear 테스트는 기존 spec 스타일(안정 텍스트 셀렉터 + Enter 키)을 따름.

### 수동 검증 절차 (growth/health/dashboard)

* 재테크: 자산목표·월예산·저축률목표를 설정 → 에디터 재오픈 후 비우고 확인 → 목표 라벨/진행바 사라짐 확인
* 자기계발: 연간 독서목표·월 영어목표 clear → 의존 진행 UI 사라짐 확인
* 건강: 주간 운동목표·수면목표 clear → 요약 위젯의 stale 타깃 사라짐 확인
* 대시보드 홈: 위 키 clear 후 홈 재진입 → asset/book/English 목표 진행 표시가 더 이상 stale하지 않음 확인

### PR

GitHub 웹에서 PR 생성 필요 (gh CLI 미설치), **base 브랜치: `develop`**
브랜치: `fix/TASK-004-local-goal-reset-and-clearing`

### 남은 이슈

없음
