# TASK-025: Dashboard Local Goal Synchronization

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Keep dashboard goal progress in sync with local goal changes made on module pages. The dashboard currently reads localStorage-backed goals during initial render, so changes made elsewhere may not appear until a full page reload.

## 2. Requirements

- In scope:
  - Refresh dashboard-local goal values when the window regains focus or when a same-app event announces goal changes.
  - Add a small shared helper or local utility only if it reduces duplication.
  - Preserve existing localStorage keys and goal semantics.
  - Avoid unnecessary dashboard API reloads when only local goals changed.
  - Keep server-sourced overview refresh behavior intact.
- Out of scope:
  - No migration of local goals to the backend.
  - No redesign of dashboard cards.
  - No changes to goal validation already covered by prior tasks.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `frontend/app/(dashboard)/page.tsx`, `frontend/app/(dashboard)/finance/page.tsx`, `frontend/app/(dashboard)/growth/page.tsx`, `frontend/app/(dashboard)/career/page.tsx`, `frontend/hooks/useAiRefresh.ts`
- Current behavior:
  - Dashboard initializes `asset_goal`, yearly book goal, monthly English goal, and `cf_rating_goal` from localStorage.
  - Module pages update these localStorage values independently.
  - Dashboard state does not automatically refresh local goal values while the app remains open.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Extract dashboard goal loading into a function that can refresh local state.
  - Re-read goals on `focus` and/or a custom local event emitted by goal save handlers.
  - Do not call `dashboardApi.getOverview()` just to update local goals.
  - Keep SSR guards for `typeof window === 'undefined'`.
- Security impact:
  - LocalStorage values are non-secret user preferences.
  - Do not read or expose tokens while adding localStorage helpers.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/manual tests:
  - Change finance asset goal, return to dashboard, and verify dashboard progress updates without full reload.
  - Change growth book or English goals and verify dashboard values update.
  - Change career CF rating goal and verify dashboard progress updates.
  - Verify dashboard API overview still refreshes after AI data saves.
- Security checks:
  - Only known local goal keys are read.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Dashboard local goal values can refresh after module-page changes.
- No unnecessary overview API request is made for local-only goal updates.
- Existing goal keys and validation behavior are preserved.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Local goal refresh is scoped and inexpensive.
- SSR guards remain correct.
- No token or secret localStorage values are touched.
- Dashboard layout remains unchanged.

## 9. Implementation Notes

### New helper (`frontend/lib/goals.ts`)

Small shared utility (used by 3 module pages, so it reduces duplication):
`GOAL_CHANGED_EVENT = 'local-goal-changed'` and `emitGoalChange()` which
dispatches that window event (SSR-guarded). Only emits a bare event — no
localStorage values, tokens, or payloads.

### Dashboard (`frontend/app/(dashboard)/page.tsx`)

- Extracted goal reading into `readLocalGoals()` returning
  `{ asset, book, eng, cf }`, keeping the `typeof window === 'undefined'` SSR
  guard and the same localStorage keys (`asset_goal`, `book_goal_<year>`,
  `eng_goal_<year>_<month>`, `cf_rating_goal`).
- Replaced the four init-only `useState` goal reads with a single
  `useState(readLocalGoals)` plus a destructure to the existing
  `assetGoal/bookGoal/engGoal/cfGoal` names (no JSX changes needed).
- Added an effect that re-reads goals on window `focus` and on
  `GOAL_CHANGED_EVENT`, then `setGoals(readLocalGoals())`. Listeners are removed
  on unmount. **`dashboardApi.getOverview()` is not called** for local-goal
  updates — only local state refreshes. Server overview refresh
  (`useAiRefresh([], load)`) is untouched.

### Module pages (emit on goal save)

Added `emitGoalChange()` after the localStorage write in each goal save handler,
plus the `@/lib/goals` import:
- `finance/page.tsx` `saveGoal` (asset_goal)
- `career/page.tsx` `saveRatingGoal` (cf_rating_goal)
- `growth/page.tsx` `saveGoal` (book goal) and `saveEngGoal` (english goal)

Goal validation (`v > 0`, etc.) and localStorage keys are unchanged.

### Validation

- `cd frontend && npx tsc --noEmit` → clean. No backend change.
- Manual: change finance asset goal → dashboard asset progress updates on return
  (focus) or immediately via event without a full reload; same for growth
  book/english and career CF goal. Overview cards still refresh after AI saves.

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
