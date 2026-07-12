# TASK-087: Current Product E2E and CI Build Gates

status: implemented
created_by: claude-code
created_at: 2026-07-12
updated_at: 2026-07-12
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal

Align automated release checks with the current Tracker-centered product and prevent lint,
production-build, or Docker packaging regressions from reaching `main`.

## 2. Requirements

- Add a Tracker E2E path covering create, record, edit, archive, restore, and delete.
- Replace obsolete Growth/Career feature E2E tests with compatibility redirect assertions.
- Run ESLint and Next.js production build in CI.
- Build backend and frontend Docker images in CI without publishing them.
- Preserve existing backend and E2E diagnostics.

## 3. Current Structure Analysis

- Files reviewed: Playwright config/setup/specs and `.github/workflows/ci.yml`.
- Growth/Career routes now redirect but their E2E specs still expect removed fixed-domain screens.
- Tracker has no E2E spec.
- CI typechecks but does not lint, production-build, or Docker-build.

## 4. Design

- Backend/API: No change.
- DB: No change; E2E cleans up its Tracker records.
- Frontend/E2E: use authenticated API cleanup and user-visible labels.
- CI: extend the frontend job and add a Docker build job.
- Security impact: use CI-only credentials; do not publish images or expose secrets in artifacts.

## 5. Test Plan

- Run frontend lint, typecheck, and production build locally.
- Validate Playwright test discovery.
- Rely on CI for the full browser/backend integration and Linux Docker builds.

## 6. Claude Code Instructions

- Preserve unrelated changes. Implement only this task. Commit and push, then update status.

## 7. Completion Criteria

- Tracker critical workflow has E2E coverage.
- Legacy routes assert redirect behavior only.
- CI runs lint, typecheck, production build, backend tests, E2E, and both Docker builds.
- Failure artifacts remain available.

## 8. PR Review Checklist

- Confirm E2E cleanup cannot delete unrelated records.
- Confirm no production credentials are committed.
- Confirm Docker images are built but not pushed.
- Confirm legacy compatibility endpoints are not broadened.

## 9. Implementation Result

- Added a Tracker E2E workflow covering create, record, edit, archive, restore, and delete.
- Replaced obsolete Growth/Career UI tests with compatibility redirect assertions.
- Added frontend lint and production build gates plus backend/frontend Docker build gates to CI.
- Implementation commit: `dfb1028`.
- Validation: frontend lint, typecheck, production build, and Playwright discovery (45 tests) passed.
