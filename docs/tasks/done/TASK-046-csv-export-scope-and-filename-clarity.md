# TASK-046: CSV Export Scope and Filename Clarity

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make CSV exports easier to understand after download by clarifying export scope, filenames, and empty-result behavior across modules.

## 2. Requirements

- In scope:
  - Audit CSV exports for module coverage, filenames, headers, and empty data behavior.
  - Add date-stamped filenames on the frontend.
  - Ensure export buttons communicate what data is included.
  - Verify travel exports include or intentionally exclude restaurant/map fields with documentation.
- Out of scope:
  - XLSX export.
  - Background export jobs.
  - Large dataset streaming redesign.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, export-related task docs.
- Files reviewed: `app/modules/export/service.py`, `app/modules/export/router.py`, `frontend/lib/api.ts`, module pages with export buttons.
- Current behavior:
  - CSV export exists for several modules.
  - Recent tasks improved empty headers and text encoding.
  - Travel data model now includes restaurants and map fields.

## 4. Design

- Backend/API: Update export fields only if needed and backward compatible.
- DB: No schema change.
- Frontend: Date-stamped filenames and clearer export button/tooltips.
- Security impact: Exports are authenticated and must not include secrets or internal fields.

## 5. Test Plan

- Backend tests: Verify headers and rows for each export, including empty data.
- Frontend/E2E tests: Verify download filenames where practical.
- Security checks: Verify unauthenticated export remains blocked.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Export filenames include module and date.
- Empty exports remain valid CSV.
- Travel export scope is explicit and tested.

## 8. PR Review Checklist

- Confirm no sensitive fields are exported.
- Confirm CSV encoding remains compatible with spreadsheet apps.
- Confirm filename changes do not break tests.
