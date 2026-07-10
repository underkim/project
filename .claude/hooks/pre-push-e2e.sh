#!/bin/bash
# PreToolUse hook, filtered to `git push*` via settings.json "if" rule.
# Runs the Playwright e2e suite (not covered by pre-commit-check.sh — too slow
# to run on every commit) against a disposable local backend + test DB before
# allowing the push, mirroring .github/workflows/ci.yml's e2e job.
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR"

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

TEST_DB=".e2e-push-check.db"
BACKEND_PORT=8911
BACKEND_LOG=$(mktemp)
MIGRATE_LOG=$(mktemp)

export DATABASE_URL="sqlite+aiosqlite:///./${TEST_DB}"
export JWT_SECRET="push-check-secret"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="admin"
export GEMINI_API_KEY="dummy"
export NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}"
export E2E_USERNAME="admin"
export E2E_PASSWORD="admin"

rm -f "$TEST_DB"

# This sandbox pre-installs Chromium at a fixed path but the pinned
# @playwright/test version may expect a newer browser build than what's
# actually on disk here (sandbox-specific mismatch, not present in real CI,
# which does its own `playwright install`). Point launchOptions.executablePath
# at the pre-installed binary via a throwaway config that extends the real
# one, instead of hardcoding this sandbox path into the shared config.
SANDBOX_CHROMIUM="/opt/pw-browsers/chromium"
OVERRIDE_CONFIG="frontend/.pw-sandbox.config.ts"
USE_OVERRIDE=0
if [ -x "$SANDBOX_CHROMIUM" ]; then
  USE_OVERRIDE=1
  cat > "$OVERRIDE_CONFIG" <<EOF
import baseConfig from './playwright.config';

export default {
  ...baseConfig,
  use: { ...baseConfig.use, launchOptions: { executablePath: '$SANDBOX_CHROMIUM' } },
};
EOF
fi

cleanup() {
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "${BACKEND_PID:-}" ] && wait "$BACKEND_PID" 2>/dev/null
  rm -f "$TEST_DB" "$BACKEND_LOG" "$MIGRATE_LOG" "$OVERRIDE_CONFIG"
}

if ! uv run alembic upgrade head > "$MIGRATE_LOG" 2>&1; then
  reason="e2e 사전 점검: 테스트 DB 마이그레이션 실패로 push가 차단되었습니다:
$(tail -20 "$MIGRATE_LOG")"
  cleanup
  deny "$reason"
fi

uv run uvicorn app.main:app --port "$BACKEND_PORT" > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${BACKEND_PORT}/api/v1/health" > /dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  reason="e2e 사전 점검: 백엔드가 30초 내에 준비되지 않아 push가 차단되었습니다:
$(tail -20 "$BACKEND_LOG")"
  cleanup
  deny "$reason"
fi

if [ "$USE_OVERRIDE" -eq 1 ]; then
  e2e_output=$(cd frontend && npx playwright test --config .pw-sandbox.config.ts 2>&1)
else
  e2e_output=$(cd frontend && npm run e2e 2>&1)
fi
e2e_status=$?

cleanup

if [ $e2e_status -ne 0 ]; then
  deny "E2E 테스트 실패로 push가 차단되었습니다. 아래 오류를 해결한 후 다시 push하세요:
$(echo "$e2e_output" | tail -50)"
fi

exit 0
