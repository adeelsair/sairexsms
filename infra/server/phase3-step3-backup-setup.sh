#!/usr/bin/env bash
# Deprecated installer — use backup-stack.sh from the repo (see docs/backup-restore.md).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export SAIREX_REPO="${SAIREX_REPO:-${HOME}/SairexSMS}"
exec "${ROOT}/scripts/backup-stack.sh" "$@"
