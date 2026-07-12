# TASK-091: AI Configurable Tracker Actions

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: feature

## 1. Goal

Let users create, update, and delete entries in existing configurable Trackers through natural
language while preserving typed validation and explicit delete confirmation.

## 2. Requirements

- Include active Tracker names, types, units, and recent values in AI context when sharing is enabled.
- Support `tracker_entry` create/update/delete using tracker name and entry date.
- Never create Tracker definitions implicitly.
- Reject archived/missing Trackers and invalid typed values.
- Keep deletion pending until the existing frontend confirmation is accepted.

## 3. Current Structure Analysis

- AI supports fixed Health/Growth/Career records but not configurable Trackers.
- AI transactions add ORM records directly and commit only at the top level.

## 4. Design

- Backend: add Tracker context and `tracker_entry` ORM action handlers.
- DB: No change.
- Frontend: map Tracker actions to `/trackers` labels and refresh behavior.
- Security impact: validate all values through `normalize_value`, escape name matching, and retain
  explicit delete confirmation.

## 5. Test Plan

- Create/update/delete happy paths, invalid value, missing/archived Tracker, and route integration.
- Full AI focused tests and frontend validation.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Natural-language actions can maintain existing Tracker entries.
- Invalid or ambiguous Tracker actions do not write data.
- Delete requires confirmation.
- Tracker page refreshes after AI saves.

## 8. PR Review Checklist

- Confirm no implicit Tracker definition creation.
- Confirm typed validation and transaction rollback.
- Confirm archived Trackers reject new entries.
- Confirm delete remains explicit.

## 9. Implementation Result

- Added active Tracker definitions and recent values to AI context when sharing is enabled.
- Added typed Tracker entry create/update/delete actions without implicit definition creation.
- Preserved explicit AI delete confirmation and added Tracker page refresh/toast routing.
- Implementation commit: `b8f193a`.
- Validation: 54 focused backend tests, frontend ESLint, TypeScript, and production build passed.
