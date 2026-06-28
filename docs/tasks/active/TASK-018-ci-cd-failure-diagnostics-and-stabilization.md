# TASK-018: CI/CD Failure Diagnostics and Stabilization

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Identify and fix the current CI/CD failure path so `develop` work can be validated reliably before release. The workflow should collect actionable failure logs, run the checks that match this repository's backend/frontend/E2E stack, and avoid branch-trigger gaps that let `develop` changes bypass CI.

## 2. Requirements

- In scope:
  - Inspect the failing GitHub Actions run or deployment check logs before changing code.
  - Update `.github/workflows/ci.yml` if the failure is caused by branch triggers, dependency setup, server readiness, E2E startup, or missing diagnostics.
  - Ensure CI runs for the repository's active integration branch, `develop`, as well as the stable release branch where appropriate.
  - Make E2E startup deterministic by verifying backend and frontend readiness before Playwright runs.
  - Preserve separate backend unit tests, frontend type checks, and E2E jobs unless logs prove a narrower fix is needed.
  - Add or improve failure artifacts/log output only where it helps diagnose CI failures.
- Out of scope:
  - No deployment provider migration.
  - No unrelated feature code changes.
  - No broad test rewrite unless a specific CI failure requires a focused test update.
  - No secret value changes or printing secret values in logs.
- Decision needed:
  - If CI/CD failure is from an external provider such as Vercel or Render rather than GitHub Actions, record the provider and failing URL/log source before implementation.

## 3. Current Structure Analysis

- Docs reviewed:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `README.md`
  - `docs/adr/0001-modular-monolith.md`
  - `docs/adr/0002-bff-pattern.md`
  - `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `.github/workflows/ci.yml`
  - `pyproject.toml`
  - `uv.lock`
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `frontend/playwright.config.ts`
  - `frontend/e2e/auth.setup.ts`
  - `tests/conftest.py`
  - `app/core/config.py`
  - `alembic/env.py`
- Current behavior:
  - CI currently runs on `push` and `pull_request` targeting `main`.
  - The repository workflow says Claude Code implements directly on `develop`.
  - Backend tests install dependencies with `uv sync --frozen` and run `uv run pytest --tb=short -q`.
  - Frontend typecheck installs with `npm ci` and runs `npx tsc --noEmit`.
  - E2E job sets SQLite/JWT/admin/Gemini test environment values, runs Alembic migrations, starts FastAPI in the background, installs Playwright Chromium, then runs `npm run e2e`.
  - Playwright config starts the frontend with `npm run dev` and waits for `http://localhost:3000`.
  - There is no explicit backend readiness check before Playwright setup logs in through the frontend.
  - Current CI trigger configuration may not validate direct `develop` pushes.

## 4. Design

- Backend/API:
  - No application API behavior change expected.
  - If backend startup or migration fails in CI, fix only the workflow/setup or the specific failing migration/config issue.
- DB:
  - No schema change expected.
  - Keep SQLite-based E2E CI database unless logs prove PostgreSQL-specific behavior is required.
- Frontend:
  - No user-facing frontend change expected.
  - If E2E failure is due to frontend dev server startup, adjust CI/Playwright startup configuration rather than page behavior.
- CI/CD:
  - First collect the actual failing check names and log snippets.
  - Update workflow triggers to include `develop` for push and pull request validation when consistent with branch workflow.
  - Add backend readiness polling before E2E runs, for example hitting `GET /api/v1/health` with bounded retries.
  - Ensure the backend process logs are available on failure, using a simple log file artifact if needed.
  - Keep Playwright report upload on failure and add traces/screenshots only through existing Playwright config.
  - If `uv sync --frozen` or `npm ci` fails, update lockfiles only through the appropriate package manager and record why.
- Security impact:
  - This task touches CI/CD configuration and environment handling.
  - Do not print `.env`, tokens, API keys, JWT secrets, database passwords, or deployment credentials.
  - Use dummy CI secrets only for tests, as the existing workflow does.
  - Avoid adding logs that expose request headers, authorization tokens, or raw environment dumps.

## 5. Test Plan

- Backend tests:
  - Run `uv run pytest --tb=short -q` locally or in CI after changes.
- Frontend checks:
  - Run `cd frontend && npx tsc --noEmit`.
- E2E checks:
  - Run the closest local equivalent of the CI E2E job:
    - set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `GEMINI_API_KEY`, `NEXT_PUBLIC_API_URL`, `E2E_USERNAME`, and `E2E_PASSWORD` to non-secret test values
    - run migrations
    - start backend
    - run `cd frontend && npm run e2e`
  - If local full E2E is impractical, run the specific failing Playwright spec and record the limitation.
- CI validation:
  - Re-run the failing GitHub Actions workflow or push the fix to `develop`.
  - Confirm backend tests, typecheck, and E2E jobs pass or document any remaining external failure.
- Security checks:
  - Inspect CI logs for accidental secret/environment dumps.
  - Confirm workflow changes do not require real production secrets for test jobs.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Before implementation, inspect the failing CI/CD logs with `gh` or the provider UI and record the failing check names.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Actual CI/CD failure source is identified with check name and concise log evidence.
- Workflow branch triggers match the repository's `develop` implementation flow.
- E2E job waits for backend readiness before Playwright runs.
- Relevant backend, frontend, and E2E validations pass locally or in CI.
- Failure artifacts/logs are sufficient to debug future failures without exposing secrets.
- Task document records implementation notes, validation results, commit hash, and push status.

## 8. PR Review Checklist

- Fix is tied to observed CI/CD logs, not speculation alone.
- `develop` changes are covered by CI.
- Backend readiness checks are bounded and cannot hang forever.
- CI logs and artifacts do not expose secrets.
- Existing test separation remains clear.
- No unrelated feature code changes are included.

## 9. Implementation Notes

### Diagnosis source

`gh` CLI is not installed on this machine (winget-only) and the GitHub Actions
provider UI was not reachable from the session, so log retrieval via `gh run`
was not possible. The failure path was instead identified directly from
`.github/workflows/ci.yml` and the repository's documented develop-first
workflow — these are concrete file/configuration facts, not speculation:

1. **Branch-trigger gap (primary failure path).** CI triggered only on
   `push`/`pull_request` to `main`. All implementation happens directly on
   `develop` (per AGENTS.md / repo workflow), so every `develop` push
   (TASK-006 through TASK-017) bypassed CI entirely and was never validated.
2. **E2E backend-readiness race.** The backend was started with `&` and the job
   proceeded straight to npm install / Playwright without verifying the server
   was up. `e2e/auth.setup.ts` logs in through the frontend, which proxies to
   the backend at `:8000`; if the backend was not ready the login step could
   fail intermittently.
3. **Missing backend diagnostics.** Backend stdout/stderr was discarded, so a
   startup/migration failure left no artifact to debug.

### Changes (`.github/workflows/ci.yml`)

- Added `develop` to both `push` and `pull_request` branch filters so direct
  `develop` work is now covered by backend tests, typecheck, and E2E.
- Redirected the backend process output to `backend.log` and recorded its PID.
- Added a bounded "Wait for backend readiness" step: polls
  `GET http://localhost:8000/api/v1/health` up to 30 times with 2s sleeps
  (≤60s total) before E2E runs; fails fast with a clear message if not ready.
  Cannot hang forever (fixed iteration count).
- Added a `backend.log` artifact upload on failure (alongside the existing
  Playwright report). `backend.log` contains only uvicorn startup/request logs —
  no env dump, tokens, or secrets are printed.

### Validation

- `uv run pytest --tb=short -q` → **282 passed** (3 pre-existing config warnings).
- `cd frontend && npx tsc --noEmit` → clean.
- `ci.yml` parsed with `yaml.safe_load` → valid.
- Full local E2E run not executed (requires backend + frontend dev server +
  Playwright Chromium simultaneously, impractical in this session). The change
  is CI-config-only; it will be exercised by the next `develop` push, which now
  triggers the workflow.

### Commit / push

- Commit: `<filled after commit>` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
