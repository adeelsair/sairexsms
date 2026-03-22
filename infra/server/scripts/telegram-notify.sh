#!/usr/bin/env bash
#
# Optional Telegram alert — credentials **only** via environment (never hardcode).
#
#   export TELEGRAM_BOT_TOKEN="..."
#   export TELEGRAM_CHAT_ID="..."
#   ./telegram-notify.sh "Your message"
#
set -euo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  exit 0
fi

MSG="${1:-SairexSMS alert}"
curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MSG}" >/dev/null
