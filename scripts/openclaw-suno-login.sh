#!/usr/bin/env bash
set -euo pipefail

# Manual operator action only.
# Do not run from CI, unattended agents, or autopilot.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_PATH="${1:-$ROOT_DIR/.openclaw-browser-profiles/suno}"

mkdir -p "$PROFILE_PATH"

if ! node -e 'import("playwright").then(() => process.exit(0)).catch(() => process.exit(1))'; then
  echo "playwright is not installed in this project. Run: npm install playwright" >&2
  exit 1
fi

node "$ROOT_DIR/scripts/openclaw-suno-login.mjs" "$PROFILE_PATH"
