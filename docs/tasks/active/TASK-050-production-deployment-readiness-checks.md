# TASK-050: Production Deployment Readiness Checks

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Reduce deployment surprises by making production readiness checks explicit for migrations, environment variables, backend tests, frontend build, and smoke validation.

## 2. Requirements

- In scope:
  - Audit deployment docs and CI scripts for required validation steps.
  - Ensure Alembic migrations are called out after schema changes like travel restaurants/map fields.
  - Document required environment variables and safe defaults.
  - Add a checklist or script for local pre-deploy validation.
  - Include backend tests, frontend type check, lint, build, and key E2E smoke checks.
- Out of scope:
  - Changing hosting providers.
  - Adding a new CI platform.
  - Managing real production secrets.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/deployment.md`, CI/CD task docs.
- Files reviewed: `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `alembic/versions/*`, package/test configs.
- Current behavior:
  - Backend tests and frontend build can pass locally.
  - Recent schema changes require production migration awareness.
  - Environment default warnings exist for unsafe local defaults.

## 4. Design

- Backend/API: No behavior change expected.
- DB: No schema change; document migration checks.
- Frontend: No behavior change expected.
- Security impact: Do not print or request secret values; document variable names only.

## 5. Test Plan

- Run documented validation commands where feasible.
- Verify docs mention migration and env var checks.
- Verify no secret values are committed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Pre-deploy checklist exists and is easy to follow.
- Migration step is explicitly documented.
- Validation commands cover backend and frontend health.
- No secrets are exposed.

## 8. PR Review Checklist

- Confirm docs are accurate for Render/Vercel/Supabase flow.
- Confirm commands work on Windows-friendly shells where possible.
- Confirm no environment values are included.
