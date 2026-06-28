# TASK-032: AI Travel Planning Confirm Before Save

status: implemented
created_by: codex
created_at: 2026-06-28
updated_at: 2026-06-28
branch: develop
assignee: Claude Code
priority: high
task_type: bugfix

## 1. Goal

Prevent the AI assistant from saving travel trips or plan items while it is still asking the user for missing itinerary details. Travel planning should be a consultative flow: ask for missing dates/preferences first, present a proposed plan, and save only after the user clearly confirms that the plan should be added.

## 2. Requirements

- In scope:
  - Update AI travel planning behavior so incomplete or exploratory travel planning requests return `action: null` and ask follow-up questions.
  - Require explicit user confirmation before creating `travel_trip`, `travel_plan`, or `travel_checklist` records from AI-generated travel plans.
  - Remove or rewrite prompt examples that encourage immediate `travel_trip + travel_plan` creation from a planning conversation.
  - Keep direct, fully specified travel record commands working when the user clearly asks to save/add/create with enough concrete data.
  - Add tests for "asks a question and does not save" travel-planning cases.
  - Add tests for "confirmed plan saves" cases if implementation introduces a confirmation action flow.
- Out of scope:
  - No redesign of the travel page.
  - No travel DB schema changes.
  - No change to delete confirmation behavior except to reuse a confirmation pattern if helpful.
  - No broad AI prompt rewrite outside travel planning safety.
- Decision needed:
  - If implementing a generic pending-create confirmation flow is larger than this task, first implement the safer prompt/server guard that blocks travel saves when the reply is asking questions, then record a follow-up task for generic create confirmation.

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
  - `app/modules/travel/service.py`
  - `app/modules/travel/schemas.py`
  - `tests/test_ai_routes.py`
  - `tests/test_travel.py`
- Current behavior:
  - AI prompt includes a general rule: missing information should return `action: null` and ask for more information.
  - AI prompt also includes travel examples that create `travel_trip` and `travel_plan` together with an `actions` array.
  - A user can ask the AI to plan a trip, and the assistant may ask questions while still returning create actions.
  - `parse_and_save()` currently saves create/update actions immediately when the model returns them.
  - Delete actions already require explicit confirmation, but create/update actions do not.

## 4. Design

- Backend/API:
  - Strengthen `_SYSTEM_PROMPT` travel planning rules:
    - exploratory planning, recommendations, "help me plan", or any response that asks the user to choose/confirm details must use `action: null`
    - only save travel records when the user explicitly says to save/add/create/register the concrete itinerary
    - a response must not both ask for missing information and include create/update actions
  - Add a server-side guard in `parse_and_save()` or `_process_multi_actions()` for travel modules:
    - if the AI reply appears to ask for user confirmation or missing information, ignore/block travel create actions and return `saved: false`
    - prefer a safe reply asking for confirmation rather than partially saving generated data
  - Preserve direct commands such as "Add my Seoul trip from 2026-08-01 to 2026-08-03" when required fields are present.
- DB: No change.
- Frontend:
  - No required change for the minimal safe fix.
  - If a pending-create confirmation flow is added, use an explicit preview and confirm/cancel buttons similar to delete confirmation.
- Security impact:
  - This task touches AI action execution and persistence.
  - Prevents unintended writes to travel data.
  - Do not expose raw AI/provider errors or internal parsing details.
  - Do not save generated travel data without clear user intent.

## 5. Test Plan

- Backend tests:
  - Add a mocked AI response where `reply` asks a follow-up question and includes travel create `actions`; assert no travel trip or plan is saved.
  - Add a mocked AI response for exploratory travel planning that returns `action: null`; assert no save occurs and response is not marked saved.
  - Keep or add a direct-save test where the user clearly requests a concrete travel trip creation with dates; assert save still works.
  - Run `uv run pytest tests/test_ai_routes.py tests/test_travel.py`.
- Frontend/E2E tests:
  - If frontend confirmation UI changes, manually verify confirm/cancel behavior and AI data refresh.
  - Otherwise manual AI chat validation is sufficient.
- Security checks:
  - Search tests should confirm unintended travel create actions are blocked.
  - No raw exception text is shown to users.

## 6. Claude Code Instructions

- Work directly on develop.
- Preserve unrelated changes.
- Implement only this task.
- Commit and push to develop, then update status to implemented.

## 7. Completion Criteria

- AI travel planning does not save while asking the user for itinerary details or confirmation.
- Prompt examples no longer encourage immediate travel plan saving for exploratory planning.
- Direct, concrete travel save commands still work.
- Tests cover blocked premature travel saves.
- No DB schema changes are introduced.
- Task document records implementation notes, validation results, commit hash, and push status.

## 8. PR Review Checklist

- A response cannot both ask a question and save travel records.
- Travel create actions require clear user intent and concrete data.
- Tests prove premature saves are blocked.
- Existing delete confirmation behavior is preserved.
- No unrelated AI prompt or travel feature changes are included.

## 9. Implementation Notes

Implemented the minimal-safe approach from the Decision note: a prompt + server
guard that blocks travel saves when the reply is asking questions (no generic
pending-create flow). All changes in `app/modules/ai/service.py` and tests.

### Prompt (`_SYSTEM_PROMPT`)

- Rewrote the "여행 계획" section: travel planning is consultative. Exploratory /
  "계획 짜줘" / missing-info responses must use `action: null` with no `actions`.
  A response must **not** both ask a question and include create/update actions.
  travel records save only when the user explicitly says
  추가/저장/만들어/등록해줘 with concrete data. Added an explicit "exploratory →
  no save" example alongside the "user confirmed → actions" example.
- Strengthened the "다단계 대화로 계획 수립" rules: questioning replies are always
  `action: null`; confirm before creating travel records.

### Server guard

- Added `_reply_seeks_confirmation(reply)` — regex detecting Korean
  question/confirmation-seeking markers (`?`, 할까요, 며칠, 언제, 어떤, 원하시,
  추천해, 제안해, …) and `_TRAVEL_MODULES = {travel_trip, travel_checklist,
  travel_plan}`.
- `_process_multi_actions`: if the reply seeks confirmation, travel
  create/update actions are filtered out before processing; if nothing remains,
  returns `saved: False` with the (question) reply. Non-travel actions are
  unaffected.
- Single-action `create`/`update` path: travel create/update is blocked and
  returns `saved: False` when the reply seeks confirmation.
- Delete confirmation flow and non-travel saves are unchanged.

### Tests (`tests/test_ai_routes.py`)

- `test_chat_travel_planning_question_blocks_save`: multi-action travel create
  with a questioning reply → `saved False`, `saved_count 0`, trip not in DB.
- `test_chat_travel_exploratory_action_null`: exploratory reply with
  `action: null` → not saved.
- `test_chat_travel_single_create_question_blocks_save`: single travel_trip
  create with a questioning reply → not saved, trip not in DB.
- Existing `test_chat_multi_actions_trip_and_plan` (confirmed, no-question reply)
  still passes — concrete direct saves keep working.

### Validation

- `uv run pytest tests/test_ai_routes.py tests/test_travel.py -q` → **70 passed**.
- `uv run pytest -q` (full) → **299 passed** (was 296; +3). No DB schema change.

### Commit / push

- Commit: `89f1a28` on `develop`.
- Pushed to `origin/develop`. No PR created (per workflow).
