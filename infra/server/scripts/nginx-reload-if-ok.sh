#!/usr/bin/env bash
# Weekly nginx config test + reload (only if nginx is installed).
# Cron should log stdout/stderr to ~/logs/sairex-nginx-check.log
set -euo pipefail

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx not installed; skipping."
  exit 0
fi

if [[ ! -d /etc/nginx ]]; then
  echo "/etc/nginx missing; skipping."
  exit 0
fi

sudo nginx -t
sudo systemctl reload nginx
echo "nginx reloaded OK at $(date -Iseconds)"
