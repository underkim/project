#!/bin/bash
set -euo pipefail

# Claude Code on the web spins up a fresh container per session, so
# dependencies must be reinstalled before pytest/tsc/playwright can run.
# Local sessions already have these installed, so skip there.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

uv sync

cd frontend
npm install
