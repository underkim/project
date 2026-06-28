# TASK-033: AI Follow-Up Duplicate Save Guard

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Prevent the AI assistant from saving the same data again when the user asks a follow-up question after a successful save. Follow-up questions such as "what did you add?", "show me what you saved", or "did that get saved?" should be treated as conversation/query responses, not as a repeat of the previous create/update action.

## 2. Requirements

- In scope:
  - Ensure only the latest user message can authorize a new create/update action.
  - Treat follow-up questions about a previous save as `action: null`.
  - Prevent duplicate create/update execution when the model repeats an earlier action because of chat history.
  - Keep direct new record commands working, including natural language logs such as "오늘 러닝 30분 했어".
  - Add tests for follow-up questions after successful saves across at least one simple module and one multi-action scenario.
  - Keep delete confirmation behavior unchanged.
- Out of scope:
  - No DB uniqueness redesign for every module.
  - No broad AI UI redesign.
  - No generic undo feature.
  - No migration of AI chat history storage.
- Decision needed: none.

## 3. Current Structure Analysis

- Docs reviewed:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `README.md`
  - `docs/adr/0001-modular-monolith.md`
  - `docs/adr/0002-bff-pattern.md`
  - `docs/adr/0003-sqlalchemy-async.md`
- Files reviewed:
  - `app/modules/ai/service.py`
  - `app/modules/ai/router.py`
  - `frontend/components/AiModal.tsx`
  - `tests/test_ai_routes.py`
- Current behavior:
  - `AiModal.getHistory()` sends recent user and AI messages to `/api/v1/ai/chat`.
  - Saved AI messages add a hint like `[저장됨 <module>]` to the history text.
  - `parse_and_save()` immediately executes create/update actions returned by the model.
  - `TASK-032` added a travel-specific guard for questioning replies, but this duplicate-save issue can affect any module.
  - There is no general guard that blocks create/update actions when the latest user message is merely asking about a previous save.

## 4. Design

- Backend/API:
  - Strengthen `_SYSTEM_PROMPT`:
    - never repeat an earlier create/update action from history
    - history is context only, not an instruction to execute again
    - follow-up questions about prior saves must return `action: null`
    - create/update requires mutation intent in the latest user message
  - Add a server-side guard before executing create/update actions:
    - detect latest user messages that are clearly follow-up/query/confirmation questions about a previous save
    - block create/update/actions for those messages and return `saved: false`
    - preserve the AI reply when it is safe, or append a safe note that no duplicate save was performed
  - Keep natural-language logging commands working when the latest user input itself contains record data and save intent.
- DB: No change.
- Frontend:
  - Consider changing history annotations so prior saves are represented as completed context, not executable instructions.
  - Do not remove useful conversational history.
  - No required UI changes unless a small copy change helps clarify "already saved".
- Security impact:
  - This task touches AI action execution and persistence.
  - Prevents unintended duplicate writes.
  - Do not expose raw AI/provider errors or internal parsing details.
  - Do not log user chat content or saved data while implementing the guard.

## 5. Test Plan

- Backend tests:
  - Mock a first AI response that creates a record successfully.
  - Send a follow-up question such as "방금 뭐 저장했어?" with history that includes the prior saved response.
  - Mock the model incorrectly returning the same create action again; assert the backend blocks the duplicate save.
  - Repeat with an `actions` array to cover multi-action duplicate attempts.
  - Add a control test showing a genuinely new latest user record command still saves.
  - Run `uv run pytest tests/test_ai_routes.py`.
- Frontend/manual tests:
  - Save a record through AI, then ask what was saved.
  - Verify the answer does not create another record.
  - Ask a new explicit record command afterward and verify it still saves.
- Security checks:
  - No chat history or action payloads are logged.
  - Delete confirmation behavior remains unchanged.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- Follow-up questions after AI saves do not repeat create/update actions.
- Server-side tests prove repeated model actions from history are blocked.
- New explicit record commands still save.
- Multi-action duplicate attempts are covered.
- Existing AI route tests remain passing.
- Task document records implementation notes, validation results, commit hash, and push status.

## 8. PR Review Checklist

- Guard uses the latest user message, not old history, to authorize mutations.
- Query/follow-up messages return `saved: false`.
- Legitimate natural-language record logging still works.
- No raw internal details or chat payloads are logged.
- No unrelated AI prompt or frontend refactor is included.

## 9. Implementation Notes

All changes in `app/modules/ai/service.py` and `tests/test_ai_routes.py`
(backend only). Builds on the TASK-032 guard pattern.

### Prompt (`_SYSTEM_PROMPT` 행동 가이드)

Added rules 13–15: never re-execute a past create/update from chat history
(history is context only, not a re-run instruction); follow-up questions about a
prior save ("방금 뭐 저장했어?", "저장됐어?", "방금 거 보여줘") must be
`action: null`; create/update only when the **latest** user message carries clear
save intent.

### Server guard (latest-message based)

- `_is_followup_query(user_input)`:
  - returns `False` if `_MUTATION_INTENT_RE` matches (imperative save verbs:
    해줘/추가해/저장해/기록해/넣어/등록/만들어/수정해/완료처리/입력해…) — so a real
    new command is never blocked;
  - otherwise returns `True` when `_FOLLOWUP_QUERY_RE` matches follow-up/query
    phrases (방금/아까, 뭐 저장/추가/기록, 저장됐/했어, 보여줘, 확인해줘…).
- In `parse_and_save`, `followup = _is_followup_query(user_input)` is computed
  once and applied to **all modules**:
  - multi-action: when `followup`, create/update actions are filtered out; if
    none remain, returns `saved: False` with the reply;
  - single-action: when `followup` and action is create/update, returns
    `saved: False`.
- Authorization is based on the **latest user message**, not history. Delete
  flow (`delete_pending`/confirmation) and the TASK-032 travel reply guard are
  unchanged. Natural-language logs ("오늘 수영 40분 했어") still save because they
  carry no follow-up markers.

### Tests (`tests/test_ai_routes.py`)

- `test_chat_followup_question_blocks_duplicate_save`: model wrongly repeats a
  health_exercise create on "방금 뭐 저장했어?" → `saved False`, no DB record.
- `test_chat_followup_question_blocks_multi_action_duplicate`: actions-array
  travel duplicate on "방금 저장한 거 보여줘" → `saved False`, trip not in DB.
- `test_chat_new_record_command_after_followup_still_saves`: "오늘 수영 40분
  했어" still saves (control).

### Validation

- `uv run pytest tests/test_ai_routes.py -q` → **37 passed** (34 + 3).
- `uv run pytest -q` (full) → **302 passed** (was 299; +3). No DB schema change.

### Commit / push

- Commit: `68ef363` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
