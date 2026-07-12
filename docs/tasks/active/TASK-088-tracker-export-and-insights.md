# TASK-088: Tracker Export and Insights

status: working
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: feature

## 1. Goal

Make configurable tracking useful over time with personal data export and easy-to-understand insight.

## 2. Requirements

- Export all Tracker definitions and entries as UTF-8 CSV, including archived and empty Trackers.
- Show record count and latest value for every Tracker.
- For numeric Trackers, show average, minimum, maximum, and recent change.

## 3. Current Structure Analysis

- Existing export endpoints cover fixed domains but not configurable Trackers.
- Tracker detail returns the recent records needed for concise insight.

## 4. Design

- Backend/API: authenticated `GET /api/v1/export/trackers`.
- DB: No change; explicitly eager-load entries.
- Frontend: CSV action and compact insight cards.
- Security impact: retain authentication and bounded, spreadsheet-safe output.

## 5. Test Plan

- Backend export content, empty/archived records, date filters, and auth.
- Frontend ESLint, TypeScript, and production build.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Tracker CSV downloads and includes all definitions.
- Numeric insight values are correct for loaded records.
- Text/checkbox Trackers show generic summaries.

## 8. PR Review Checklist

- Confirm empty and archived Trackers are not omitted.
- Confirm export remains authenticated.
