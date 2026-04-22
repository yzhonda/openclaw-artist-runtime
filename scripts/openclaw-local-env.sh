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

export OPENCLAW_LOCAL_ROOT="${openclaw_local_root}"
export OPENCLAW_LOCAL_PREFIX="${openclaw_local_prefix}"
export OPENCLAW_HOME="${openclaw_local_home}"
export OPENCLAW_STATE_DIR="${openclaw_local_state}"
export OPENCLAW_CONFIG_PATH="${openclaw_local_config_path}"
export OPENCLAW_LOCAL_WORKSPACE="${openclaw_local_workspace}"
export OPENCLAW_LOCAL_LOGS="${openclaw_local_logs}"
export PATH="${OPENCLAW_LOCAL_PREFIX}/bin:${PATH}"

if [[ "${1:-}" == "print" ]]; then
  cat <<EOF
OPENCLAW_LOCAL_ROOT=${OPENCLAW_LOCAL_ROOT}
OPENCLAW_LOCAL_PREFIX=${OPENCLAW_LOCAL_PREFIX}
OPENCLAW_HOME=${OPENCLAW_HOME}
OPENCLAW_STATE_DIR=${OPENCLAW_STATE_DIR}
OPENCLAW_CONFIG_PATH=${OPENCLAW_CONFIG_PATH}
OPENCLAW_LOCAL_WORKSPACE=${OPENCLAW_LOCAL_WORKSPACE}
OPENCLAW_LOCAL_LOGS=${OPENCLAW_LOCAL_LOGS}
EOF
fi
