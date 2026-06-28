# TASK-045: Travel Geocoding Resilience and Rate Limit Handling

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Make travel address geocoding reliable and polite to external services while preserving manual map coordinate selection as the most reliable path.

## 2. Requirements

- In scope:
  - Audit `app/modules/travel/geocoding.py` behavior for timeout, failure, and rate-limit scenarios.
  - Ensure failed geocoding never blocks saving a trip or restaurant when coordinates are optional.
  - Improve user feedback when an address cannot be resolved.
  - Avoid repeated external requests for unchanged addresses where practical.
- Out of scope:
  - Adding paid geocoding providers.
  - Reverse geocoding.
  - Public place search.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, travel task docs.
- Files reviewed: `app/modules/travel/geocoding.py`, `app/modules/travel/service.py`, travel frontend page/map components, `tests/test_travel.py`.
- Current behavior:
  - Travel supports Leaflet/OpenStreetMap and address geocoding.
  - Manual coordinates are supported by recent map picker work.
  - External geocoding failures should be handled gracefully.

## 4. Design

- Backend/API: Add timeout/rate-limit-safe behavior and optional lightweight caching if appropriate.
- DB: No schema change expected unless a tiny cached coordinate field is already present and reusable.
- Frontend: Show clear fallback guidance to use map click selection when geocoding fails.
- Security impact: Send only user-entered address to geocoding; never notes/plans/checklists.

## 5. Test Plan

- Backend tests: Mock timeout, no result, and rate-limit responses.
- Frontend/E2E tests: Verify failed address lookup still allows manual map selection.
- Security checks: Verify no private notes are sent to geocoding.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Geocoding failure is non-fatal.
- User receives useful fallback guidance.
- Repeated unchanged address saves do not spam external geocoding.

## 8. PR Review Checklist

- Confirm no new provider key is introduced.
- Confirm errors are sanitized.
- Confirm manual coordinate selection still takes precedence.
