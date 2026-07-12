# TASK-085: Self-Hosted Single-User Distribution

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Make Life Dashboard safe and understandable to install as a personal single-user service without
requiring knowledge of the repository's former managed-cloud deployment.

## 2. Requirements

- Document the supported single-user product boundary explicitly.
- Provide a Docker Compose quick start with secure required credentials.
- Document update, backup, restore, health-check, and troubleshooting workflows.
- Keep SQLite available for local development and PostgreSQL as the Docker default.
- Explain that exposing the service publicly requires HTTPS and network-level protection.

## 3. Current Structure Analysis

- Docs reviewed: `README.md`, `docs/deployment.md`, `docs/pre-deploy-checklist.md`.
- Files reviewed: `.env.example`, `docker-compose.yml`, backend/frontend Dockerfiles.
- Docker Compose currently falls back to a known development database password.
- Existing deployment documentation primarily targets Render, Supabase, and Vercel.
- Authentication is intentionally a single administrator configured through environment variables.

## 4. Design

- Backend/API: No change.
- DB: No schema change; add documented PostgreSQL dump/restore procedures.
- Frontend: No change.
- Deployment: require an explicit PostgreSQL password, add restart policies and service health checks,
  and provide a self-hosting guide linked from the README.
- Security impact: prevent accidental known-password deployments; document unique JWT/admin secrets,
  HTTPS, non-public database ports, backup protection, and secret rotation.

## 5. Test Plan

- Backend tests: No backend change.
- Deployment checks: validate Compose configuration using `.env.example` when Docker is available.
- Documentation checks: verify all commands, paths, ports, and links match repository files.
- Security checks: ensure no real secret is committed and no default production password remains.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- A new installer can reach the login screen from the documented steps.
- Compose refuses to start without an explicit database password.
- Persistent data location and backup/restore commands are documented.
- Update and rollback cautions are documented.
- Public exposure security requirements are explicit.

## 8. PR Review Checklist

- Confirm examples contain placeholders only.
- Confirm the database is not published to the host.
- Confirm backup commands target the named Compose volume/database.
- Confirm migration execution remains part of API startup.
- Confirm managed-cloud docs are not presented as the only supported deployment.

## 9. Implementation Result

- Added a dedicated personal single-user installation, update, backup, restore, security, and
  troubleshooting guide.
- Removed the known PostgreSQL fallback password and added Compose restart policies.
- Added a Docker startup preflight that rejects placeholder/short secrets and invalid public URLs
  without printing secret values.
- Implementation commit: `9fe091d`.
- Validation: 397 backend tests and direct self-host preflight execution passed.
