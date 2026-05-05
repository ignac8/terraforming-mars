#!/usr/bin/env bash
# TaskCompleted hook — every completed task title must include a "Rules-covered: ..." trailer
# so the rules-verifier has something to audit against. Exit 2 to block completion if missing.

set -uo pipefail

# The task payload is delivered on stdin as JSON; use jq if available, else fall back to grep.
PAYLOAD=$(cat)

if command -v jq >/dev/null 2>&1; then
  TITLE=$(echo "$PAYLOAD" | jq -r '.task.title // .title // ""')
else
  TITLE=$(echo "$PAYLOAD" | grep -o '"title"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"title"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

if [ -z "$TITLE" ]; then
  # Couldn't parse — don't block on parse failure.
  exit 0
fi

if echo "$TITLE" | grep -qE 'Rules-covered:[[:space:]]*[A-Z]-[A-Za-z0-9, -]+'; then
  exit 0
fi

{
  echo "Task title is missing the 'Rules-covered: <ids>' trailer."
  echo "Got: $TITLE"
  echo "Every completed task must declare which numbered rules it covers, so the rules-verifier can audit it."
  echo "Example: 'Implement B17 city placement (Rules-covered: C-3, C-4)'"
} >&2
exit 2
