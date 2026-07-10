#!/bin/bash
# PreToolUse hook, filtered to `git commit*` via settings.json "if" rule.
# Blocks the commit if the backend test suite or frontend typecheck fails,
# mirroring the checks in .github/workflows/ci.yml so CI-breaking commits
# never land in the first place.
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR"

# 활동 로그(.claude/state/activity-log.json)만 변경된 커밋은 코드 변경이 아니므로
# 전체 테스트/타입체크를 생략한다 — 그렇지 않으면 실시간에 가까운 로그 스트리밍을 위해
# 자주 커밋할 때마다 ~40초씩 걸려 목적 자체가 무의미해진다.
staged_files=$(git diff --cached --name-only)
if [ "$staged_files" = ".claude/state/activity-log.json" ]; then
  exit 0
fi

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

pytest_output=$(uv run pytest -q 2>&1)
if [ $? -ne 0 ]; then
  deny "pytest 실패로 커밋이 차단되었습니다. 아래 오류를 해결한 후 다시 커밋하세요:
$(echo "$pytest_output" | tail -25)"
fi

tsc_output=$(cd frontend && npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  deny "TypeScript 타입 오류로 커밋이 차단되었습니다. 아래 오류를 해결한 후 다시 커밋하세요:
$(echo "$tsc_output" | tail -25)"
fi

exit 0
