# TASK-030: Frontend Build Copy Integrity Audit

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: medium
task_type: improvement

## 1. Goal

Audit and fix corrupted user-facing Korean text in frontend source files where it affects visible UI labels, placeholders, titles, or messages. The app should not ship mojibake in production UI.

## 2. Requirements

- In scope:
  - Search frontend source for corrupted Korean/mojibake in user-visible strings.
  - Fix only clear user-facing text corruption in active app files.
  - Preserve code identifiers, API paths, route names, storage keys, and test selectors.
  - Prioritize navigation labels, form labels, placeholders, toast messages, titles, and button text.
  - Run TypeScript/build checks after edits.
- Out of scope:
  - No design/layout refactor.
  - No backend text cleanup unless needed for visible frontend output.
  - No translation of identifiers or technical constants.
  - No broad copywriting rewrite beyond corruption repair.
- Decision needed:
  - If a corrupted string's intended meaning is ambiguous, leave a short note in the task document rather than guessing.

## 3. Current Structure Analysis

- Docs reviewed: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-bff-pattern.md`, `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `frontend/components/Sidebar.tsx`
  - `frontend/components/AiModal.tsx`
  - dashboard pages under `frontend/app/(dashboard)/`
  - `frontend/app/(auth)/login/page.tsx`
- Current behavior:
  - Several inspected frontend files display mojibake in user-facing Korean labels and messages.
  - Some strings may be console decoding artifacts, so each candidate must be verified in source and, if practical, browser output.
  - Corrupted labels reduce usability and trust even when functionality works.

## 4. Design

- Backend/API: No change.
- DB: No change.
- Frontend:
  - Use targeted search and manual review rather than automated blind replacement.
  - Fix strings in small coherent batches.
  - Keep visual layout unchanged.
  - Verify text does not overflow existing controls after repair.
- Security impact:
  - No security surface change expected.
  - Do not touch secrets, `.env`, tokens, or credentials while searching.

## 5. Test Plan

- Backend tests: No backend change.
- Frontend checks:
  - Run `cd frontend && npx tsc --noEmit`.
  - Run `cd frontend && npm run build`.
- Manual validation:
  - Inspect login, sidebar, dashboard, planner, finance, health, growth, career, travel, and AI modal screens for readable labels.
  - Verify repaired labels still fit in their controls on desktop and mobile widths.
- Security checks:
  - Confirm no secret-bearing files were read or printed.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Clear frontend mojibake in user-facing strings is repaired.
- Ambiguous strings are documented rather than guessed.
- TypeScript and production build pass.
- No unrelated UI redesign is included.
- Task document records implementation notes and validation results.

## 8. PR Review Checklist

- Only user-facing corrupted text was changed.
- Layout and behavior are unchanged.
- Ambiguous copy was not guessed.
- Build and typecheck pass.

## 9. Implementation Notes

### Audit result: no actual mojibake in frontend source

Scanned every frontend source file (`.ts/.tsx/.js/.jsx/.css`, excluding
`node_modules`/`.next`/`.git`):

- **No non-UTF-8 files** — all decode cleanly as UTF-8.
- **No U+FFFD replacement characters** and **no mojibake byte sequences**
  (checked for Latin-1-decoded-UTF-8 artifacts like `Ã`/`Â` followed by
  high bytes).
- Byte-verified representative user-facing strings are correct, readable Korean
  by exact substring match against proper Hangul literals:
  - `Sidebar.tsx` nav labels: 대시보드, 플래너, 재테크, 건강, 자기계발, 커리어,
    여행, 가이드, 로그아웃 — all present.
  - `login/page.tsx`: 계속하려면 로그인하세요, 아이디, 비밀번호, 로그인.
  - `Toast.tsx`: 알림 닫기. `AiModal.tsx`: AI 어시스턴트, 삭제 확인,
    삭제 대상 확인, 조건에 맞는 전체 항목.

As with TASK-024, the "corruption" observed during inspection is a **Windows
console code-page (cp949) display artifact** when piping UTF-8 text through the
terminal — the stored file bytes are correct. No source change was needed; no
strings were ambiguous, so nothing was guessed.

### Validation

- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm run build` → success, all 11 routes generated.
- No `.env`/secret files were read during the audit (scan limited to source
  text files by extension).

### Commit / push

- No code change required (audit only). Task document committed on `develop`.
- Commit: `<filled after commit>`. No PR created (per workflow).
