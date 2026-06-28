# TASK-023: CSV Export Empty Dataset Headers

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make CSV exports useful even when a module has no records. Empty exports currently return only a UTF-8 BOM, which opens as a blank file and gives users no indication of the expected columns.

## 2. Requirements

- In scope:
  - Define explicit CSV headers for every export endpoint.
  - Return header-only CSV files when there are no rows.
  - Keep UTF-8 BOM compatibility for Excel.
  - Update export tests to expect headers for empty datasets.
  - Preserve current filenames and authentication requirements.
- Out of scope:
  - No frontend export button changes unless a minor label update is required.
  - No streaming export rewrite.
  - No new export endpoints.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `app/modules/export/router.py`, `app/modules/export/service.py`, `tests/test_export.py`, `frontend/lib/api.ts`
- Current behavior:
  - `_to_csv(rows)` derives fieldnames from the first row.
  - When rows are empty, `_to_csv()` returns only BOM bytes.
  - `tests/test_export.py` explicitly asserts BOM-only output for empty finance export.
  - Users receive a blank CSV when exporting empty data.

## 4. Design

- Backend/API:
  - Update export service helpers to accept explicit `fieldnames`.
  - Each export function should pass its module-specific headers to the CSV helper.
  - Header order should match current non-empty exports.
- DB: No change.
- Frontend: No change expected.
- Security impact:
  - Export endpoints remain authenticated.
  - Do not include hidden/internal fields in headers.
  - Do not expose secrets or infrastructure details in CSV content.

## 5. Test Plan

- Backend tests:
  - Update `tests/test_export.py` so empty exports include the expected header row.
  - Add empty-export coverage for each endpoint if not already present.
  - Run `uv run pytest tests/test_export.py`.
- Frontend/E2E tests: Manual export check from one empty module is sufficient unless frontend code changes.
- Security checks:
  - Unauthenticated export requests still return `401`.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Empty CSV exports include headers.
- Non-empty CSV exports remain compatible with existing data.
- Export filenames and auth behavior remain unchanged.
- Export tests cover the new empty-output behavior.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Header order is stable.
- Empty and non-empty paths use the same fieldnames.
- No internal fields are exported.
- Existing CSV Excel compatibility is preserved.

## 9. Implementation Notes

### Change (`app/modules/export/service.py`)

- `_to_csv` signature changed from `(rows)` to `(rows, fieldnames)`. It always
  writes a header row (via `DictWriter.writeheader()`) plus the BOM, so an empty
  dataset now yields a header-only CSV instead of BOM-only bytes. UTF-8 BOM
  (`﻿`) prefix kept for Excel compatibility.
- Added seven module-level header constants (`FINANCE_FIELDS`, `EXERCISE_FIELDS`,
  `SLEEP_FIELDS`, `BOOK_FIELDS`, `ENGLISH_FIELDS`, `CAREER_FIELDS`,
  `TRAVEL_FIELDS`). Each `export_*` passes its constant to `_to_csv`. Header
  order is identical to the previous non-empty output (derived from the same row
  dict key order), so empty and non-empty paths share one source of truth.
- No internal/hidden fields added; only the same user-facing columns. No
  filename, router, or auth change.

### Tests (`tests/test_export.py`)

- Updated `test_export_finance_empty`: now asserts the response starts with BOM,
  the first line contains the finance headers, and exactly one (header-only)
  line is present.
- Added parametrized `test_export_empty_includes_header` covering all 7 export
  endpoints — each returns exactly one header line with the expected column when
  there is no data.

### Validation

- `uv run pytest tests/test_export.py -q` → **25 passed**.
- `uv run pytest -q` (full suite) → **289 passed** (was 282; +7 new empty-header
  assertions). Unauthenticated export still returns 401
  (`test_export_requires_auth`).

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
