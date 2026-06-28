# TASK-024: CSV Export Text Encoding Audit

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Ensure CSV export headers, test fixtures, and user-visible export strings render as intended Korean text instead of mojibake. Export files are user-facing artifacts, so corrupted labels make downloaded data hard to understand.

## 2. Requirements

- In scope:
  - Audit `app/modules/export/service.py` and `tests/test_export.py` for corrupted Korean literals.
  - Replace corrupted user-facing CSV headers and fixture strings with correct UTF-8 Korean text.
  - Keep API paths, filenames, and code identifiers unchanged.
  - Add tests that assert representative readable Korean headers after `utf-8-sig` decoding.
  - Verify source files are saved as UTF-8.
- Out of scope:
  - No broad UI copy cleanup outside export-related files.
  - No schema or endpoint changes.
  - No translation of code identifiers.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed: `app/modules/export/service.py`, `tests/test_export.py`, `app/modules/export/router.py`
- Current behavior:
  - Export service contains Korean CSV headers that appear corrupted in local inspection.
  - Export tests also assert corrupted strings, which can lock in the bad output.
  - Export responses still return CSV bytes with BOM, but the visible labels may be unreadable to users.

## 4. Design

- Backend/API:
  - Replace export header literals with correct Korean labels.
  - Keep row values unchanged except for test fixture strings that are intentionally user-visible.
  - Centralize headers per export if this reduces duplication with TASK-023.
- DB: No change.
- Frontend: No change expected.
- Security impact:
  - Export content remains authenticated and read-only.
  - Do not add hidden fields or sensitive data while editing headers.

## 5. Test Plan

- Backend tests:
  - Run `uv run pytest tests/test_export.py`.
  - Verify decoded CSV contains readable labels such as date, memo, title, status, destination, checklist, and plan equivalents.
- Frontend/E2E tests: Manual download of one CSV and open in a UTF-8 aware viewer or Excel.
- Security checks:
  - Auth-required export tests still pass.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Export CSV headers render as intended Korean text.
- Tests no longer assert mojibake strings.
- CSV output still decodes with `utf-8-sig`.
- No new fields or secrets are exported.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- User-facing CSV labels are readable.
- Tests validate the corrected labels.
- Endpoint behavior and filenames are unchanged.
- No unrelated copy cleanup is included.

## 9. Implementation Notes

### Audit result: no actual mojibake in the source

Audited `app/modules/export/service.py` and `tests/test_export.py`:

- Both files decode cleanly as **UTF-8** (verified with `bytes.decode('utf-8')`).
- AST-walked every string literal in `service.py`: every non-ASCII character in
  the header constants is a valid HANGUL syllable (or CJK/ASCII). The only
  non-Hangul symbol flagged was `→` (U+2192) inside a code comment — legitimate,
  not corruption.
- Byte-level check: `FINANCE_FIELDS` equals
  `['날짜','총자산(만원)','월수입(만원)','월지출(만원)','저축액(만원)','저축률(%)','메모']`
  exactly, and `"날짜"` is stored as `eb82a0eca79c` (correct UTF-8).

The "corrupted" appearance reported during inspection is a **Windows console
code-page (cp949) display artifact** when piping UTF-8 through the terminal —
the stored file bytes are correct. The TASK-023 rewrite already used correct
Korean labels, and tests decode them with `utf-8-sig` and pass.

### Change (`tests/test_export.py`)

Since no source correction was needed, the deliverable is an
**encoding-regression guard**: added parametrized
`test_export_headers_are_readable_korean` that, for all 7 export endpoints,
decodes the response with `utf-8-sig`, splits the header line on `,`, and
asserts the column list equals the exact expected readable Korean headers
(date/memo/title/status/destination/checklist/plan equivalents included). Any
future mojibake or header reordering now fails the suite.

No change to `service.py`, endpoints, filenames, or row content.

### Validation

- `uv run pytest tests/test_export.py -q` → **32 passed** (25 + 7 new).
- Source files confirmed UTF-8; auth-required export tests still pass (401).

### Commit / push

- Commit: `446027e` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
