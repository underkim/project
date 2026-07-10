#!/bin/bash
# PostToolUse hook, matcher: Write|Edit.
# After Claude writes/edits a frontend .ts/.tsx file, auto-fix what ESLint can
# and surface any remaining errors back into the conversation so they get
# addressed immediately instead of surfacing later at commit/CI time.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

if [ -z "$file" ]; then
  exit 0
fi
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac
case "$file" in
  */frontend/*) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR/frontend" || exit 0
rel="${file#*/frontend/}"

output=$(npx eslint --fix "$rel" 2>&1)

# eslint exits 0 for warnings-only runs (no CI lint gate enforces --max-warnings 0
# in this project), so check output content rather than exit code — otherwise
# warnings like no-unused-vars or exhaustive-deps would pass through silently.
if [ -n "$output" ]; then
  jq -n --arg reason "$output" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: ("ESLint 경고/오류가 남아있습니다 (자동 수정 후에도 남은 것):\n" + $reason)
    }
  }'
fi
exit 0
