#!/usr/bin/env bash
#
# Safe periodic Docker cleanup — run from cron (weekly).
#
# Intentionally does NOT use `docker system prune --volumes`:
#   named volumes (Postgres/Redis data) must never be auto-deleted.
#
# Usage:
#   sudo -u sairex /path/to/SairexSMS/infra/server/scripts/docker-prune-safe.sh
# Cron example (Sunday 03:15):
#   15 3 * * 0 /home/sairex/SairexSMS/infra/server/scripts/docker-prune-safe.sh >>/var/log/sairex-docker-prune.log 2>&1
#
set -euo pipefail

log() {
  echo "[$(date -Iseconds)] $*"
}

if ! docker info >/dev/null 2>&1; then
  log "ERROR: docker not reachable (run as user in docker group, or with proper context)"
  exit 1
fi

log "Pruning build cache..."
docker builder prune -af

log "Pruning dangling images only (keeps tags still referenced)..."
docker image prune -f

log "Pruning unused images (not used by any container — including stopped)..."
# Safer than unlimited growth; running containers keep their layers.
docker image prune -a -f

log "Pruning stopped containers (not running)..."
docker container prune -f

log "Docker disk summary after prune:"
docker system df || true

log "Done."
