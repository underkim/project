# TASK-005: Dashboard Weekly Report Safe Rendering

status: approved
type: improvement
priority: high
created_by: codex
implemented_by:
reviewed_by:

created_at: 2026-06-28
approved_at: 2026-06-28
implemented_at:
reviewed_at:
merged_at:

branch:
pr:
merge_commit:

---

## 1. Goal

Remove the XSS surface in the dashboard weekly report modal by rendering AI report text safely without injecting raw HTML into the page.

This improvement is needed because the current dashboard weekly report UI uses `dangerouslySetInnerHTML` on Gemini-generated report text. Even though the report is intended to be simple markdown-like content, the current renderer will trust embedded HTML and insert it into the DOM.

## 2. Requirements

### In Scope

* Replace unsafe weekly report rendering in the dashboard modal with a safe text-to-React rendering path.
* Preserve the current user-facing weekly report presentation as closely as practical:
  * headings from `#`, `##`, `###`
  * simple bullet lines from `- ` or `* `
  * bold text from `**text**`
  * line breaks and paragraph spacing
* Ensure AI report content that contains literal HTML-like text is displayed as text, not interpreted as DOM.
* Add focused regression coverage for the weekly report modal rendering path using the repo's existing frontend E2E style.
* Keep the current weekly report API contract unchanged.

### Out of Scope

* Redesigning the dashboard page or modal layout
* Changing AI prompt wording or weekly report generation logic on the backend
* Supporting full markdown, tables, raw HTML, or rich embedded media
* Refactoring all markdown-like rendering across the frontend in this task

### Security Impact

This task touches authenticated AI output rendering in the frontend.

The implementation must ensure that:

* AI-generated content is never inserted into the DOM as trusted HTML
* `<script>`, event-handler attributes, image tags, and similar HTML fragments from report text cannot execute
* safe formatting support does not reintroduce HTML injection through string concatenation
* the UI still shows useful report content without exposing users to DOM-based XSS

## 3. Current Structure Analysis

### Relevant Documents Reviewed

* `AGENTS.md`
* `CLAUDE.md`
* `README.md`
* `docs/adr/0001-modular-monolith.md`
* `docs/adr/0002-bff-pattern.md`
* `docs/adr/0003-sqlalchemy-async.md`
* `docs/tasks/done/TASK-002-ai-router-error-sanitization.md`

### Relevant Files

* `frontend/app/(dashboard)/page.tsx`
* `frontend/components/AiModal.tsx`
* `frontend/lib/api.ts`
* `frontend/e2e/dashboard.spec.ts`
* `app/modules/ai/router.py`
* `app/modules/ai/service.py`

### Observed Current Behavior

* `WeeklyReportModal` in `frontend/app/(dashboard)/page.tsx` fetches report text from `GET /api/v1/ai/weekly-report`.
* `ReportMarkdown` currently converts `**bold**` syntax by building HTML strings and passes them to `dangerouslySetInnerHTML`.
* Bullet lines and normal lines both allow raw HTML embedded in report text to become active DOM.
* `frontend/components/AiModal.tsx` already renders AI chat text using React nodes instead of `dangerouslySetInnerHTML`, so the unsafe pattern is not required for readable formatting.
* `frontend/lib/api.ts` surfaces backend error messages, but the weekly report success payload is plain text and does not need HTML interpretation.

### Risk Summary

The current behavior creates a concrete frontend security risk:

* if the weekly report text ever contains HTML, the dashboard modal will render it as DOM
* AI output is not a trusted source and can drift in format over time
* a future prompt change, provider quirk, or malicious upstream text could turn the weekly report into an execution vector inside an authenticated dashboard session

## 4. Impact Scope

### Frontend

* `frontend/app/(dashboard)/page.tsx`
  * replace `dangerouslySetInnerHTML` usage in `ReportMarkdown`
  * keep current visual hierarchy while rendering with safe React nodes
* If a small helper component is extracted, keep it local and narrow in scope

### Backend

* No backend logic changes required
* No AI prompt changes required
* No API payload changes required

### Database / Migration

* No schema changes
* No migration required

### Tests

* `frontend/e2e/dashboard.spec.ts`
  * add a focused regression test for weekly report rendering
* If implementation prefers a tiny pure rendering helper, an additional lightweight frontend unit-style test is acceptable only if a matching test harness is introduced without broad setup churn

## 5. Design Decision

Render weekly report text as escaped React content with minimal markdown-like parsing instead of injecting HTML.

### Chosen Approach

* Replace the current HTML-string-based renderer with a safe parser that returns React elements.
* Support only the subset of formatting already used by the UI:
  * headings
  * bullet lines
  * bold segments
* Treat every non-format token as plain text.
* Do not attempt to support arbitrary inline HTML.

### Rejected Alternative 1

Keep `dangerouslySetInnerHTML` and add ad hoc string escaping before insertion.

Reason:
This is error-prone and easy to regress. Safe React-node rendering is simpler and more defensible.

### Rejected Alternative 2

Introduce a large markdown/HTML sanitization dependency for this one modal.

Reason:
That adds dependency and maintenance cost for a narrow formatting need that can be handled with existing patterns already present in the repo.

## 6. API Design

* No endpoint changes
* No request changes
* No response schema changes

### Existing Endpoint

| Method | Path | Change |
| ------ | ---- | ------ |
| GET | `/api/v1/ai/weekly-report` | No API change; frontend treats returned `report` as plain text |

### Contract Expectation

The `report` field remains a plain string. Formatting is inferred client-side from simple markdown-like markers, not from HTML.

## 7. DB Design

* No schema changes
* No relationship changes
* No migration required

## 8. Frontend Design

### Required UX Changes

* The weekly report modal must continue to display readable structured output.
* HTML-looking content in the report must appear as text.
* Existing heading, list, and bold emphasis should remain visually recognizable.
* Loading and error states should remain unchanged.

### Rendering Notes

* Prefer a safe parser similar in spirit to `MarkdownText` in `frontend/components/AiModal.tsx`.
* Keep formatting intentionally limited.
* If raw angle brackets appear in report text, users should see the literal characters, not rendered HTML elements.

## 9. Test Plan

### Frontend E2E Coverage

Add or update `frontend/e2e/dashboard.spec.ts` with a weekly report regression scenario that:

* intercepts `GET /api/v1/ai/weekly-report`
* returns a payload containing:
  * a heading line
  * a bullet line
  * `**bold**`
  * an HTML payload such as `<img src=x onerror=window.__xss=1>`
* opens the weekly report modal
* verifies the safe text is visible
* verifies no `<img>` from the injected payload is created inside the rendered report container

Suggested assertions:

* heading text is visible
* bullet text is visible
* bold text is visible
* the literal `<img ...>` string is shown or at minimum no injected image element exists

### Manual Validation

After implementation, confirm that:

* weekly report still looks readable on desktop and mobile-width layouts
* line breaks and section spacing remain understandable
* error and loading behavior is unchanged

### Suggested Validation Commands

Document after implementation, but do not run during planning:

```bash
cd frontend && npm run e2e -- dashboard.spec.ts
cd frontend && npm run lint
```

## 10. Claude Code Implementation Instructions

This task is already `status: approved`. Claude Code may implement it immediately.

### Branch Workflow

* Implement directly on `develop`.
* Do not create a new task branch for this work.
* After implementation and validation, commit and push to `develop`, then update this task to `implemented`.

### Files To Edit

* `frontend/app/(dashboard)/page.tsx`
* `frontend/e2e/dashboard.spec.ts`
* Optionally a tiny local helper file if it keeps the renderer clear without broad refactor

### Implementation Sequence

1. Re-read `CLAUDE.md`, `README.md`, and ADRs `0001` through `0003`.
2. Remove `dangerouslySetInnerHTML` usage from the dashboard weekly report rendering path.
3. Implement a safe React-node renderer for the currently supported markdown-like subset.
4. Keep modal loading and error flows unchanged.
5. Add an E2E regression that proves injected HTML is not rendered as DOM.
6. Validate locally, commit to `develop`, push `develop`, and update this task status to `implemented`.

### Constraints

* Do not change `app/modules/ai/service.py` prompt logic in this task.
* Do not add broad markdown features that increase parsing complexity.
* Do not introduce a large sanitization library unless existing repo patterns clearly require it.
* Keep the change limited to safe rendering and focused regression coverage.

## 11. Completion Criteria

* The dashboard weekly report modal no longer uses `dangerouslySetInnerHTML`.
* AI weekly report content is rendered through safe React nodes.
* Literal HTML fragments from report text do not become DOM elements.
* Existing readable structure for headings, bullets, and bold text is preserved.
* A frontend regression test covers the unsafe HTML case.
* No API, database, or migration changes are introduced.

## 12. PR Review Checklist

* [ ] `frontend/app/(dashboard)/page.tsx` no longer injects weekly report HTML with `dangerouslySetInnerHTML`
* [ ] Weekly report formatting still supports the intended heading/list/bold subset
* [ ] AI-provided HTML-like text is rendered safely as text
* [ ] Regression coverage proves injected HTML does not create DOM nodes
* [ ] Loading and error states for the weekly report modal remain intact
* [ ] No backend/API/schema changes or unrelated refactors were introduced
* [ ] Security review confirms the dashboard no longer trusts AI report HTML
