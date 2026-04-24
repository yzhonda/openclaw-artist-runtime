#!/usr/bin/env bash
set -euo pipefail

YES=0
ROOT="."
DAYS=30

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      YES=1
      shift
      ;;
    --root)
      ROOT="${2:-}"
      [[ -n "$ROOT" ]] || {
        echo "--root requires a path" >&2
        exit 1
      }
      shift 2
      ;;
    --days)
      DAYS="${2:-}"
      [[ "$DAYS" =~ ^[0-9]+$ ]] || {
        echo "--days requires a whole number" >&2
        exit 1
      }
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

TARGET="${ROOT%/}/runtime/suno"
if [[ ! -d "$TARGET" ]]; then
  echo "No runtime Suno directory found: $TARGET"
  exit 0
fi

mapfile -t CANDIDATES < <(find "$TARGET" -mindepth 1 -maxdepth 1 -type d -mtime +"$DAYS" -print | sort)

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  echo "No runtime Suno run directories older than $DAYS days."
  exit 0
fi

echo "Runtime Suno directories older than $DAYS days:"
printf '  %s\n' "${CANDIDATES[@]}"

if [[ "$YES" -ne 1 ]]; then
  printf "Delete these directories? Type yes to continue: "
  read -r ANSWER
  if [[ "$ANSWER" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

rm -rf -- "${CANDIDATES[@]}"
echo "Deleted ${#CANDIDATES[@]} runtime Suno director$( [[ ${#CANDIDATES[@]} -eq 1 ]] && echo 'y' || echo 'ies' )."
