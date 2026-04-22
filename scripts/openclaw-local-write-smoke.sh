#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "${script_dir}/openclaw-local-env.sh"

base_url="${OPENCLAW_LOCAL_GATEWAY_HTTP_URL}"
workspace_root="${OPENCLAW_LOCAL_WORKSPACE}"

post_json() {
  local path="$1"
  local json="$2"
  local target="${base_url}${path}"
  echo "POST ${target}"
  curl -fsS -X POST "${target}" \
    -H "content-type: application/json" \
    --data "${json}" >/dev/null
}

config_json="$(cat <<EOF
{"config":{"artist":{"workspaceRoot":"${workspace_root}"}}}
EOF
)"

config_patch_json="$(cat <<EOF
{"config":{"artist":{"workspaceRoot":"${workspace_root}"}},"patch":{"autopilot":{"dryRun":true,"enabled":false},"distribution":{"enabled":false}}}
EOF
)"

post_json "/plugins/artist-runtime/api/config/update" "${config_patch_json}"
post_json "/plugins/artist-runtime/api/pause" "${config_json}"
post_json "/plugins/artist-runtime/api/resume" "${config_json}"
post_json "/plugins/artist-runtime/api/run-cycle" "${config_json}"

echo "artist-runtime write smoke passed"
