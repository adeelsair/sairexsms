#!/usr/bin/env bash
#
# Warn if root filesystem use exceeds a threshold (default 80%).
# Use with cron + mail, or pipe to your alert stack.
#
# Usage:
#   THRESHOLD_PERCENT=80 ./disk-alert.sh
#   ./disk-alert.sh && echo OK || echo ALERT
#
set -euo pipefail

THRESHOLD_PERCENT="${THRESHOLD_PERCENT:-80}"

# Parse `df -P` use% for mount point /
pct="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"

if [[ -z "${pct}" ]] || ! [[ "${pct}" =~ ^[0-9]+$ ]]; then
  echo "disk-alert: could not parse disk use for /" >&2
  exit 2
fi

if (( pct >= THRESHOLD_PERCENT )); then
  echo "DISK ALERT: / is ${pct}% full (threshold ${THRESHOLD_PERCENT}%)"
  df -h /
  docker system df 2>/dev/null || true
  exit 1
fi

echo "disk-ok: / is ${pct}% full (threshold ${THRESHOLD_PERCENT}%)"
exit 0
