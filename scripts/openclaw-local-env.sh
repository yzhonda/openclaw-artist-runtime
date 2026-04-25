#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

openclaw_local_root="${repo_root}/.local/openclaw"
openclaw_local_prefix="${openclaw_local_root}"
openclaw_local_home="${openclaw_local_root}/home"
openclaw_local_state="${openclaw_local_root}/state"
openclaw_local_config_dir="${openclaw_local_root}/config"
openclaw_local_config_path="${openclaw_local_config_dir}/openclaw.json"
openclaw_local_workspace="${openclaw_local_root}/workspace"
openclaw_local_logs="${openclaw_local_root}/logs"
openclaw_local_gateway_pid="${openclaw_local_logs}/gateway.pid"
openclaw_local_gateway_log="${openclaw_local_logs}/gateway.log"
openclaw_local_gateway_port="${OPENCLAW_LOCAL_GATEWAY_PORT:-43134}"
openclaw_local_gateway_http_url="http://127.0.0.1:${openclaw_local_gateway_port}"
openclaw_local_gateway_ws_url="ws://127.0.0.1:${openclaw_local_gateway_port}"
social_credentials_path="${repo_root}/.local/social-credentials.env"

if [[ -f "${social_credentials_path}" ]]; then
  # shellcheck source=/dev/null
  source "${social_credentials_path}"
fi

export OPENCLAW_LOCAL_ROOT="${openclaw_local_root}"
export OPENCLAW_LOCAL_PREFIX="${openclaw_local_prefix}"
export OPENCLAW_HOME="${openclaw_local_home}"
export OPENCLAW_STATE_DIR="${openclaw_local_state}"
export OPENCLAW_CONFIG_PATH="${openclaw_local_config_path}"
export OPENCLAW_LOCAL_WORKSPACE="${openclaw_local_workspace}"
export OPENCLAW_LOCAL_LOGS="${openclaw_local_logs}"
export OPENCLAW_LOCAL_GATEWAY_PID="${openclaw_local_gateway_pid}"
export OPENCLAW_LOCAL_GATEWAY_LOG="${openclaw_local_gateway_log}"
export OPENCLAW_LOCAL_GATEWAY_PORT="${openclaw_local_gateway_port}"
export OPENCLAW_LOCAL_GATEWAY_HTTP_URL="${openclaw_local_gateway_http_url}"
export OPENCLAW_LOCAL_GATEWAY_WS_URL="${openclaw_local_gateway_ws_url}"
export PATH="${OPENCLAW_LOCAL_PREFIX}/bin:${PATH}"

if [[ -n "${BIRD_FIREFOX_PROFILE:-}" ]]; then
  export OPENCLAW_X_FIREFOX_PROFILE="${BIRD_FIREFOX_PROFILE}"
fi

if [[ "${1:-}" == "print" ]]; then
  cat <<EOF
OPENCLAW_LOCAL_ROOT=${OPENCLAW_LOCAL_ROOT}
OPENCLAW_LOCAL_PREFIX=${OPENCLAW_LOCAL_PREFIX}
OPENCLAW_HOME=${OPENCLAW_HOME}
OPENCLAW_STATE_DIR=${OPENCLAW_STATE_DIR}
OPENCLAW_CONFIG_PATH=${OPENCLAW_CONFIG_PATH}
OPENCLAW_LOCAL_WORKSPACE=${OPENCLAW_LOCAL_WORKSPACE}
OPENCLAW_LOCAL_LOGS=${OPENCLAW_LOCAL_LOGS}
OPENCLAW_LOCAL_GATEWAY_PID=${OPENCLAW_LOCAL_GATEWAY_PID}
OPENCLAW_LOCAL_GATEWAY_LOG=${OPENCLAW_LOCAL_GATEWAY_LOG}
OPENCLAW_LOCAL_GATEWAY_PORT=${OPENCLAW_LOCAL_GATEWAY_PORT}
OPENCLAW_LOCAL_GATEWAY_HTTP_URL=${OPENCLAW_LOCAL_GATEWAY_HTTP_URL}
OPENCLAW_LOCAL_GATEWAY_WS_URL=${OPENCLAW_LOCAL_GATEWAY_WS_URL}
OPENCLAW_X_FIREFOX_PROFILE=${OPENCLAW_X_FIREFOX_PROFILE:-}
EOF
fi
