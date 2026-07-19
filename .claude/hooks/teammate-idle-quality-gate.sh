#!/usr/bin/env bash
# TeammateIdle hook — runs lint, build, and server tests before letting a teammate go idle.
# Exit 2 with feedback on stderr to keep the teammate working until the gate passes.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

# Use the .nvmrc-pinned Node — the system default may be a different major whose
# ABI breaks native modules (better-sqlite3) in the shared node_modules.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null 2>&1

LOG=$(mktemp -t marsbot-idle-XXXXXX.log)
trap 'rm -f "$LOG"' EXIT

run() {
  local name=$1; shift
  echo "--- $name ---" >> "$LOG"
  if ! "$@" >> "$LOG" 2>&1; then
    return 1
  fi
}

ok=1
run "npm run lint:server"  npm run lint:server  || ok=0
run "npm run build:server" npm run build:server || ok=0
run "npm run test:server"  npm run test:server  || ok=0

if [ "$ok" = 1 ]; then
  exit 0
fi

{
  echo "Quality gate failed before idle. You cannot stop until lint, build, and tests pass."
  echo "Last 80 lines of output:"
  tail -n 80 "$LOG"
} >&2
exit 2
