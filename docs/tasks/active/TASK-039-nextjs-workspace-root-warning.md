# TASK-039: Next.js Workspace Root Warning

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Remove the Next.js build warning about incorrect workspace root detection so local and deployment builds use the intended frontend project root consistently.

## 2. Requirements

- In scope:
  - Fix the Next.js warning that selects `C:\Users\rlaeh\Desktop\package-lock.json` as the workspace root.
  - Configure the frontend build so `frontend/package-lock.json` is treated as the relevant lockfile/root.
  - Keep `output: 'standalone'` behavior.
  - Document the reason for the configuration in a short comment if useful.
- Out of scope:
  - Removing files outside the repository.
  - Changing package manager.
  - Reworking deployment architecture.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/deployment.md`.
- Files reviewed: `frontend/next.config.ts`, `frontend/package.json`, `frontend/package-lock.json`.
- Current behavior:
  - `npm.cmd run build` succeeds.
  - Build emits a warning that Next.js inferred the workspace root as `C:\Users\rlaeh\Desktop` because another lockfile exists there.
  - The warning can cause confusion and potentially unstable standalone output/caching.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Update `frontend/next.config.ts` with the supported `turbopack.root` configuration pointing at the frontend directory.
  - Verify the setting works with Next.js 16.2.9.
  - Keep existing standalone output unchanged.
- Security impact:
  - No security behavior change expected.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend/E2E tests:
  - Run `npm.cmd run build`.
  - Confirm the workspace root warning no longer appears.
  - Run `npx.cmd tsc --noEmit` if config typing changes.
- Security checks: No security-specific checks needed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Next.js production build succeeds.
- Workspace root warning is gone.
- Standalone output remains enabled.
- No files outside the repository are modified or deleted.

## 8. PR Review Checklist

- Confirm the config is valid for the installed Next.js version.
- Confirm no unrelated frontend config changes are included.
- Confirm deployment docs still match the build behavior.
