#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
MODE="dry-run"
EXTRACT_DIR="/tmp/openclaw-spec-extract"
INTERNAL_REPO_URL="git@github.com:yzhonda/openclaw-artist-runtime-internal-specs.git"

TARGET_PATHS="
docs/full-spec/
docs/codex-detailed-specs/
AGENTS.md
AGENTS.distribution-short.md
CODEX_START_HERE.md
SPEC_INDEX.md
docs/log/
docs/ask/
docs/SOURCE_NOTES.md
docs/0[0-9]_*.md
docs/1[0-5]_*.md
reference/original-starter-scaffold/
"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} [--dry-run|--apply] [--extract-dir PATH] [--internal-repo URL]

Prepare or execute the history sanitization flow for internal planning docs.

Default:
  --dry-run     Print every destructive command without executing git filter-repo.

Options:
  --apply       Execute local filter-repo operations after interactive confirmation.
  --extract-dir PATH
                Mirror clone output path for extracted internal specs.
                Default: ${EXTRACT_DIR}
  --internal-repo URL
                Private mirror remote to show in operator handoff commands.
                Default: ${INTERNAL_REPO_URL}
  --help        Show this help.

This script never runs git push --force and never creates GitHub repositories.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

run() {
  if [ "$MODE" = "apply" ]; then
    "$@"
  else
    printf '+'
    for arg in "$@"; do
      printf ' %s' "$(printf '%s' "$arg" | sed "s/'/'\\\\''/g; s/.*/'&'/")"
    done
    printf '\n'
  fi
}

require_clean_tree() {
  if [ -n "$(git status --porcelain)" ]; then
    die "working tree is not clean"
  fi
}

require_main_branch() {
  branch="$(git branch --show-current)"
  if [ "$branch" != "main" ]; then
    die "current branch must be main, got: ${branch}"
  fi
}

require_no_open_prs() {
  if ! command -v gh >/dev/null 2>&1; then
    die "gh is required to verify open PR count"
  fi
  open_count="$(gh pr list --state open --json number --jq 'length')"
  if [ "$open_count" != "0" ]; then
    die "open PR count must be 0 before history rewrite, got: ${open_count}"
  fi
}

require_synced_remote() {
  git fetch origin main >/dev/null 2>&1
  counts="$(git rev-list --left-right --count origin/main...HEAD)"
  ahead="$(printf '%s' "$counts" | awk '{print $2}')"
  behind="$(printf '%s' "$counts" | awk '{print $1}')"
  if [ "$ahead" != "0" ] || [ "$behind" != "0" ]; then
    die "main must be synced with origin/main, behind=${behind}, ahead=${ahead}"
  fi
}

require_filter_repo() {
  if ! command -v git-filter-repo >/dev/null 2>&1 && ! git filter-repo --help >/dev/null 2>&1; then
    die "git filter-repo is required; install it before running --apply"
  fi
}

path_args() {
  for target in $TARGET_PATHS; do
    printf ' --path %s' "$target"
  done
}

print_target_paths() {
  echo "Target paths:"
  for target in $TARGET_PATHS; do
    echo "  - ${target}"
  done
}

confirm_apply() {
  echo
  echo "DANGER: --apply rewrites local git history with git filter-repo."
  echo "It still does not force-push and does not create a private repo."
  printf "Type SANITIZE to continue: "
  read answer
  if [ "$answer" != "SANITIZE" ]; then
    die "confirmation failed"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --apply)
      MODE="apply"
      shift
      ;;
    --extract-dir)
      [ "$#" -ge 2 ] || die "--extract-dir requires a value"
      EXTRACT_DIR="$2"
      shift 2
      ;;
    --internal-repo)
      [ "$#" -ge 2 ] || die "--internal-repo requires a value"
      INTERNAL_REPO_URL="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1"
      ;;
  esac
done

echo "History sanitize preparation mode: ${MODE}"
echo "Extract dir: ${EXTRACT_DIR}"
echo "Internal repo URL: ${INTERNAL_REPO_URL}"
print_target_paths
echo

echo "Pre-flight checks:"
require_clean_tree
echo "  ok: working tree clean"
require_main_branch
echo "  ok: current branch main"
require_no_open_prs
echo "  ok: open PR count 0"
require_synced_remote
echo "  ok: origin/main synced"
require_filter_repo
echo "  ok: git filter-repo available"

stamp="$(date -u +%Y-%m-%d)"
backup_branch="main-pre-sanitize-${stamp}"

if [ "$MODE" = "apply" ]; then
  confirm_apply
fi

echo
echo "Planned local backup:"
run git branch "$backup_branch" main

echo
echo "Planned internal-spec mirror extraction:"
run rm -rf "$EXTRACT_DIR"
run git clone --mirror "$(git remote get-url origin)" "$EXTRACT_DIR"
echo "+ cd '${EXTRACT_DIR}'"
if [ "$MODE" = "apply" ]; then
  (
    cd "$EXTRACT_DIR"
    # shellcheck disable=SC2086
    git filter-repo $(path_args) --force
  )
else
  echo "+ git filter-repo$(path_args) --force"
fi

echo
echo "Planned source repository sanitize:"
if [ "$MODE" = "apply" ]; then
  # shellcheck disable=SC2086
  git filter-repo $(path_args) --invert-paths --force
else
  echo "+ git filter-repo$(path_args) --invert-paths --force"
fi

echo
echo "Operator-only follow-up commands, not executed by this script:"
cat <<EOF
  gh repo create yzhonda/openclaw-artist-runtime-internal-specs --private
  cd ${EXTRACT_DIR}
  git remote set-url origin ${INTERNAL_REPO_URL}
  git push --mirror origin
  cd -
  git log --oneline --decorate --graph --max-count=20
  git push --force origin main
EOF

echo
echo "Done. If this was --dry-run, no history rewrite was performed."
