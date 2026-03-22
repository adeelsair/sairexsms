#!/usr/bin/env bash
#
# SairexSMS — production server automation (SAFE / idempotent)
#
# Implements the *intent* of a "one-command ops bootstrap" without known-dangerous
# patterns from copy-paste guides:
#   - NEVER schedules: docker system prune --volumes  (data-loss risk)
#   - NEVER appends duplicate cron lines on re-run
#   - Does NOT mass `docker update` all containers (Compose already sets restart policies)
#   - Docker daemon.json + `systemctl restart docker` is OPT-IN (causes brief full restart)
#
# Usage (on the VPS, from repo root or anywhere):
#   SAIREX_REPO=/home/sairex/SairexSMS bash infra/server/scripts/bootstrap-server-automation.sh
#   SAIREX_REPO=/home/sairex/SairexSMS bash infra/server/scripts/bootstrap-server-automation.sh --dry-run
#
# Optional flags (all require sudo when used):
#   --with-fail2ban          apt install + enable fail2ban
#   --with-packages          apt install curl jq ncdu (jq optional for daemon merge)
#   --with-docker-logging    merge json-file max-size into /etc/docker/daemon.json
#                            ONLY if ALLOW_DOCKER_RESTART=true (see below)
#   --with-journal-vacuum    install /etc/cron.weekly/sairex-journal-vacuum
#   --with-nginx-check       add weekly `nginx -t && reload` to managed cron (if nginx exists)
#
set -euo pipefail

SAIREX_REPO="${SAIREX_REPO:-${HOME}/SairexSMS}"
LOG_DIR="${LOG_DIR:-${HOME}/logs}"
DRY_RUN=false
WITH_FAIL2BAN=false
WITH_PACKAGES=false
WITH_DOCKER_LOGGING=false
WITH_JOURNAL_VACUUM=false
WITH_NGINX_CHECK=false

MARK_BEGIN="# BEGIN sairex-automation"
MARK_END="# END sairex-automation"

log() { echo "[bootstrap] $*"; }
die() { echo "[bootstrap] ERROR: $*" >&2; exit 1; }

need_sudo() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "(dry-run) would run sudo: $*"
    return 0
  fi
  sudo -n true 2>/dev/null || die "sudo required (passwordless or run in an interactive shell). Tried: $*"
}

for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=true ;;
    --with-fail2ban) WITH_FAIL2BAN=true ;;
    --with-packages) WITH_PACKAGES=true ;;
    --with-docker-logging) WITH_DOCKER_LOGGING=true ;;
    --with-journal-vacuum) WITH_JOURNAL_VACUUM=true ;;
    --with-nginx-check) WITH_NGINX_CHECK=true ;;
    --all-safe)
      WITH_FAIL2BAN=true
      WITH_PACKAGES=true
      WITH_JOURNAL_VACUUM=true
      WITH_NGINX_CHECK=true
      ;;
    -h|--help)
      grep '^#' "$0" | head -n 28
      exit 0
      ;;
    *) die "unknown arg: ${arg}" ;;
  esac
done

if [[ ! -d "${SAIREX_REPO}/infra/server/scripts" ]]; then
  die "SAIREX_REPO not found or invalid: ${SAIREX_REPO}"
fi

PRUNE_SCRIPT="${SAIREX_REPO}/infra/server/scripts/docker-prune-safe.sh"
DISK_SCRIPT="${SAIREX_REPO}/infra/server/scripts/disk-alert.sh"
[[ -f "${PRUNE_SCRIPT}" ]] || die "missing ${PRUNE_SCRIPT}"
[[ -f "${DISK_SCRIPT}" ]] || die "missing ${DISK_SCRIPT}"

if [[ "${DRY_RUN}" != "true" ]]; then
  mkdir -p "${LOG_DIR}"
  chmod +x "${PRUNE_SCRIPT}" "${DISK_SCRIPT}" "${SAIREX_REPO}/infra/server/scripts/bootstrap-server-automation.sh" 2>/dev/null || true
fi

# --- apt / fail2ban ---
if [[ "${WITH_PACKAGES}" == "true" ]]; then
  need_sudo apt-get update
  if [[ "${DRY_RUN}" != "true" ]]; then
    sudo apt-get install -y curl ncdu
    sudo apt-get install -y jq || true
  fi
fi

if [[ "${WITH_FAIL2BAN}" == "true" ]]; then
  need_sudo apt-get update
  if [[ "${DRY_RUN}" != "true" ]]; then
    sudo apt-get install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban || true
  fi
fi

# --- Docker daemon.json (json-file limits) — opt-in restart ---
if [[ "${WITH_DOCKER_LOGGING}" == "true" ]]; then
  if [[ "${ALLOW_DOCKER_RESTART:-false}" != "true" ]]; then
    log "Skipping Docker daemon.json: set ALLOW_DOCKER_RESTART=true to apply (restarts Docker → brief container restart)."
  else
    need_sudo mkdir -p /etc/docker
    if [[ "${DRY_RUN}" == "true" ]]; then
      log "would merge log-driver json-file max-size 10m max-file 3 into /etc/docker/daemon.json"
    else
      if [[ -f /etc/docker/daemon.json ]] && command -v jq >/dev/null 2>&1; then
        sudo cp -a /etc/docker/daemon.json "/etc/docker/daemon.json.bak.$(date +%s)"
        sudo jq '. + {"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' \
          /etc/docker/daemon.json | sudo tee /etc/docker/daemon.json.new >/dev/null
        sudo mv /etc/docker/daemon.json.new /etc/docker/daemon.json
      else
        printf '%s\n' '{' '  "log-driver": "json-file",' '  "log-opts": {' '    "max-size": "10m",' '    "max-file": "3"' '  }' '}' | sudo tee /etc/docker/daemon.json >/dev/null
      fi
      sudo systemctl restart docker
      log "Docker restarted with json-file log limits."
    fi
  fi
fi

# --- journal vacuum (root weekly) ---
if [[ "${WITH_JOURNAL_VACUUM}" == "true" ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    log "would install /etc/cron.weekly/sairex-journal-vacuum"
  else
    need_sudo tee /etc/cron.weekly/sairex-journal-vacuum >/dev/null <<'EOF'
#!/bin/sh
# SairexSMS — cap systemd journal growth (safe, idempotent)
journalctl --vacuum-time=7d >/dev/null 2>&1 || true
EOF
    sudo chmod +x /etc/cron.weekly/sairex-journal-vacuum
  fi
fi

# --- Idempotent user crontab block ---
strip_managed_cron() {
  awk -v b="${MARK_BEGIN}" -v e="${MARK_END}" '
    $0 == b {skip=1; next}
    $0 == e {skip=0; next}
    skip {next}
    {print}
  '
}

# Drop legacy duplicate lines from manual cron installs (outside managed block).
strip_legacy_sairex_cron_lines() {
  grep -vF "infra/server/scripts/docker-prune-safe.sh" | grep -vF "infra/server/scripts/disk-alert.sh" \
    | grep -vF "infra/server/scripts/nginx-reload-if-ok.sh" || true
}

build_managed_block() {
  echo "${MARK_BEGIN}"
  echo "15 3 * * 0 ${PRUNE_SCRIPT} >>${LOG_DIR}/sairex-docker-prune.log 2>&1"
  echo "0 */6 * * * THRESHOLD_PERCENT=80 ${DISK_SCRIPT} >>${LOG_DIR}/sairex-disk-alert.log 2>&1"
  if [[ "${WITH_NGINX_CHECK}" == "true" ]]; then
    # Dedicated helper so we do not inline fragile sudo in cron
    echo "0 5 * * 0 ${SAIREX_REPO}/infra/server/scripts/nginx-reload-if-ok.sh >>${LOG_DIR}/sairex-nginx-check.log 2>&1"
  fi
  echo "${MARK_END}"
}

if [[ "${DRY_RUN}" == "true" ]]; then
  log "dry-run: managed crontab block would be:"
  build_managed_block | sed 's/^/  /'
else
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | strip_managed_cron | strip_legacy_sairex_cron_lines | sed '/^$/d' >"${tmp}" || true
  build_managed_block >>"${tmp}"
  crontab "${tmp}"
  rm -f "${tmp}"
  log "Installed idempotent sairex-automation crontab block."
fi

log "Done. Review: crontab -l"
log "SSH hardening is manual — see docs/production-ops-checklist.md"
log "Do NOT add docker system prune --volumes to cron."
