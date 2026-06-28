# TASK-012: Career External Link Validation

status: done
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: improvement

## 1. Goal
Make career profile external links safer and more convenient by validating stored profile fields and normalizing user-entered URLs before rendering clickable links.

The career page lets users save Codeforces handle, GitHub username, and blog URL. These values are later used to construct outbound links. The current schema trims non-empty strings, but it does not validate blog URL scheme or restrict username-like fields. This can lead to broken links, confusing UX, or unsafe link schemes in the browser.

## 2. Requirements
- In scope:
  - Validate `blog_url` so only safe `http://` or `https://` URLs are accepted.
  - Normalize bare blog domains in the frontend by adding `https://` before save or clearly reject them with a helpful message.
  - Validate `github_username` against a safe GitHub username pattern.
  - Validate `cf_handle` against a safe Codeforces handle pattern that avoids path separators and whitespace.
  - Keep existing ability to clear fields by sending `null`.
  - Show user-friendly validation messages without exposing internal details.
- Out of scope:
  - Calling GitHub or Codeforces APIs to verify that profiles exist.
  - Adding new career fields.
  - Redesigning the career page.
  - Changing rating log behavior.

## 3. Current Structure Analysis
- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`.
- Files reviewed: `frontend/app/(dashboard)/career/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`, `app/modules/career/schemas.py`.
- Current behavior:
  - `CareerSettingsUpdate.not_empty` trims non-empty values.
  - The frontend renders Codeforces, GitHub, and blog links directly from stored values.
  - `blog_url` can currently be any non-empty string.
  - `github_username` and `cf_handle` can include characters that produce broken or misleading paths.

## 4. Design
- Backend/API:
  - Extend `CareerSettingsUpdate` validators with safe patterns for `cf_handle`, `github_username`, and `blog_url`.
  - Accept `null` for clearing fields.
  - Return normal FastAPI/Pydantic validation errors for invalid values without leaking internals.
- DB: No schema change.
- Frontend:
  - Normalize a bare blog domain to `https://...` before calling `careerApi.updateSettings()` or show inline/toast feedback if invalid.
  - Keep the current profile settings form layout.
  - Avoid rendering a clickable blog link unless it is a safe `http` or `https` URL.
  - Keep `rel="noopener noreferrer"` on external links.
- Security impact:
  - This directly addresses external link safety and user input validation.
  - Prevent unsafe URL schemes such as `javascript:` from being saved or rendered as clickable links.
  - Avoid path injection in generated GitHub and Codeforces profile links.
  - Do not log or expose raw validation internals.

## 5. Test Plan
- Backend tests:
  - Add career settings validation tests for accepted `https://` blog URLs.
  - Add rejection tests for unsafe schemes such as `javascript:` and unsupported schemes.
  - Add username/handle rejection tests for whitespace and path separators.
  - Add clearing tests that `null` remains accepted.
- Frontend/E2E tests:
  - Validate bare blog domain normalization or user-facing rejection, depending on implementation choice.
  - Validate unsafe blog URL does not become a clickable link.
  - Run TypeScript check.
- Security checks:
  - Confirm rendered external links use safe schemes only.
  - Confirm `target="_blank"` links retain `rel="noopener noreferrer"`.

## 6. Claude Code Instructions
- Work directly on `develop`.
- Preserve unrelated changes.
- Implement only this task.
- Do not create a new task branch.
- Update career backend validation first, then frontend normalization/render guards.
- Keep validation patterns conservative but not overly restrictive for legitimate handles.
- Run focused career tests and frontend type check.
- Commit and push to `develop`, then update this task to `implemented` with validation results.

## 7. Completion Criteria
- Unsafe blog URL schemes cannot be saved.
- Bare blog domains are either normalized to `https://` or rejected with a clear user-facing message.
- GitHub usernames with spaces, slashes, or URL-like values are rejected.
- Codeforces handles with spaces or path separators are rejected.
- Clearing profile fields with `null` still works.
- External links render only when values are safe.
- Existing rating log create/edit/delete behavior remains unchanged.

## 8. PR Review Checklist
- URL validation allows only `http` and `https` schemes.
- Username/handle validation prevents path injection and broken generated links.
- Clearing optional settings still works.
- Frontend does not render unsafe links.
- Error messages are useful without exposing internals.
- No external API calls or new dependencies were added unnecessarily.
