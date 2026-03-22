#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/sairex/SairexSMS}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-infra/server/docker-compose.prod.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-infra/server/server.env.live}"
SAIREX_ENV_FILE_VALUE="${SAIREX_ENV_FILE_VALUE:-$(basename "${ENV_FILE_PATH}")}"
IMAGE_REF="${IMAGE_REF:?IMAGE_REF is required (example: ghcr.io/owner/sairexsms:sha-abc123)}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
CREATE_DB_BACKUP="${CREATE_DB_BACKUP:-true}"
UP_NO_DEPS="${UP_NO_DEPS:-true}"
AUTO_CLEAN_CONFLICTS="${AUTO_CLEAN_CONFLICTS:-true}"
# NEVER default to true: removing db/redis containers every deploy forces Postgres recovery
# and Redis restarts — users see login/API failures until recovery finishes.
AUTO_CLEAN_DATA_SERVICES="${AUTO_CLEAN_DATA_SERVICES:-false}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_DIR="${BACKUP_DIR:-/opt/sairex/backups}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"
POSTGRES_READY_MAX_CHECKS="${POSTGRES_READY_MAX_CHECKS:-90}"
POSTGRES_READY_SLEEP_SECONDS="${POSTGRES_READY_SLEEP_SECONDS:-2}"
REDIS_READY_MAX_CHECKS="${REDIS_READY_MAX_CHECKS:-60}"
REDIS_READY_SLEEP_SECONDS="${REDIS_READY_SLEEP_SECONDS:-2}"
APP_HEALTH_MAX_CHECKS="${APP_HEALTH_MAX_CHECKS:-40}"
APP_HEALTH_SLEEP_SECONDS="${APP_HEALTH_SLEEP_SECONDS:-5}"
APP_LOG_TAIL_LINES="${APP_LOG_TAIL_LINES:-200}"
CORE_SERVICE_MAX_CHECKS="${CORE_SERVICE_MAX_CHECKS:-30}"
CORE_SERVICE_SLEEP_SECONDS="${CORE_SERVICE_SLEEP_SECONDS:-2}"
EDGE_ROUTER_MODE="${EDGE_ROUTER_MODE:-auto}"

APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-sairex_app}"
WORKER_CONTAINER_NAME="${WORKER_CONTAINER_NAME:-sairex_worker}"
SMS_WORKER_CONTAINER_NAME="${SMS_WORKER_CONTAINER_NAME:-sairex_sms_worker}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-sairex_db}"
REDIS_CONTAINER_NAME="${REDIS_CONTAINER_NAME:-sairex_redis}"

cd "${APP_DIR}"

if [[ ! -f "${COMPOSE_FILE_PATH}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE_PATH}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE_PATH}" ]]; then
  echo "Env file not found: ${ENV_FILE_PATH}" >&2
  exit 1
fi

compose_cmd() {
  SAIREX_ENV_FILE="${SAIREX_ENV_FILE_VALUE}" \
    docker compose -f "${COMPOSE_FILE_PATH}" --env-file "${ENV_FILE_PATH}" "$@"
}

container_exists() {
  local name="$1"
  docker inspect "$name" >/dev/null 2>&1
}

remove_container_if_exists() {
  local name="$1"
  if ! container_exists "$name"; then
    return 0
  fi
  echo "Auto-clean: removing existing container ${name}"
  docker rm -f "$name" >/dev/null 2>&1 || true
}

auto_clean_conflicts_for_app_services() {
  [[ "${AUTO_CLEAN_CONFLICTS}" == "true" ]] || return 0
  remove_container_if_exists "${APP_CONTAINER_NAME}"
  remove_container_if_exists "${WORKER_CONTAINER_NAME}"
  remove_container_if_exists "${SMS_WORKER_CONTAINER_NAME}"
}

auto_clean_conflicts_for_data_services() {
  [[ "${AUTO_CLEAN_DATA_SERVICES}" == "true" ]] || return 0
  [[ "${AUTO_CLEAN_CONFLICTS}" == "true" ]] || return 0
  echo "AUTO_CLEAN_DATA_SERVICES=true: removing db/redis containers if present (use only to fix name conflicts)."
  remove_container_if_exists "${DB_CONTAINER_NAME}"
  remove_container_if_exists "${REDIS_CONTAINER_NAME}"
}

wait_for_container_running() {
  local container_name="$1"
  local checks="$2"
  local sleep_seconds="$3"
  local state=""
  for ((i=1; i<=checks; i++)); do
    state="$(docker inspect --format '{{.State.Status}}' "${container_name}" 2>/dev/null || true)"
    echo "Service check ${container_name} ${i}/${checks}: ${state:-unknown}"
    if [[ "${state}" == "running" ]]; then
      return 0
    fi
    sleep "${sleep_seconds}"
  done
  return 1
}

ensure_core_services() {
  echo "Ensuring core services are running (db, redis)..."
  compose_cmd up -d db redis

  wait_for_container_running "${DB_CONTAINER_NAME}" "${CORE_SERVICE_MAX_CHECKS}" "${CORE_SERVICE_SLEEP_SECONDS}" || {
    echo "Database container is not running: ${DB_CONTAINER_NAME}" >&2
    return 1
  }
  wait_for_container_running "${REDIS_CONTAINER_NAME}" "${CORE_SERVICE_MAX_CHECKS}" "${CORE_SERVICE_SLEEP_SECONDS}" || {
    echo "Redis container is not running: ${REDIS_CONTAINER_NAME}" >&2
    return 1
  }

  wait_for_postgres_accepting_connections || return 1
  wait_for_redis_responding || return 1

  echo "Core services are running."
}

wait_for_postgres_accepting_connections() {
  echo "Waiting for PostgreSQL to accept connections (pg_isready)..."
  for ((i = 1; i <= POSTGRES_READY_MAX_CHECKS; i++)); do
    if compose_cmd exec -T db pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      echo "PostgreSQL is ready (${i}/${POSTGRES_READY_MAX_CHECKS})."
      return 0
    fi
    echo "PostgreSQL not ready yet (${i}/${POSTGRES_READY_MAX_CHECKS})..."
    sleep "${POSTGRES_READY_SLEEP_SECONDS}"
  done
  echo "PostgreSQL did not become ready in time." >&2
  compose_cmd logs --tail 80 db 2>/dev/null || true
  return 1
}

wait_for_redis_responding() {
  echo "Waiting for Redis to respond (PING)..."
  for ((i = 1; i <= REDIS_READY_MAX_CHECKS; i++)); do
    if compose_cmd exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
      echo "Redis is ready (${i}/${REDIS_READY_MAX_CHECKS})."
      return 0
    fi
    echo "Redis not ready yet (${i}/${REDIS_READY_MAX_CHECKS})..."
    sleep "${REDIS_READY_SLEEP_SECONDS}"
  done
  echo "Redis did not become ready in time." >&2
  compose_cmd logs --tail 80 redis 2>/dev/null || true
  return 1
}

print_app_diagnostics() {
  echo "---- App diagnostics (docker inspect) ----" >&2
  docker inspect "${APP_CONTAINER_NAME}" --format '{{json .State}}' 2>/dev/null || true
  echo "---- App diagnostics (container logs tail) ----" >&2
  docker logs --tail "${APP_LOG_TAIL_LINES}" "${APP_CONTAINER_NAME}" 2>/dev/null || true
  echo "---- App diagnostics (compose service logs tail) ----" >&2
  compose_cmd logs --tail "${APP_LOG_TAIL_LINES}" app 2>/dev/null || true
}

print_edge_diagnostics() {
  echo "---- Edge diagnostics ----" >&2
  echo "EDGE_ROUTER_MODE=${EDGE_ROUTER_MODE}" >&2
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  echo "App port mappings:" >&2
  docker port "${APP_CONTAINER_NAME}" 2>/dev/null || true
}

assert_edge_routing_ready() {
  local app_ports
  app_ports="$(docker port "${APP_CONTAINER_NAME}" 2>/dev/null || true)"
  local traefik_running="false"
  if docker inspect --format '{{.State.Status}}' traefik 2>/dev/null | grep -q '^running$'; then
    traefik_running="true"
  fi

  if [[ "${EDGE_ROUTER_MODE}" == "nginx" ]]; then
    if ! echo "${app_ports}" | grep -q '127\.0\.0\.1:3000'; then
      echo "EDGE check failed (nginx mode): expected ${APP_CONTAINER_NAME} to publish 127.0.0.1:3000." >&2
      print_edge_diagnostics
      return 1
    fi
    return 0
  fi

  if [[ "${EDGE_ROUTER_MODE}" == "traefik" ]]; then
    if [[ "${traefik_running}" != "true" ]]; then
      echo "EDGE check failed (traefik mode): traefik container is not running." >&2
      print_edge_diagnostics
      return 1
    fi
    return 0
  fi

  # auto mode: accept either known-good edge path
  if echo "${app_ports}" | grep -q '127\.0\.0\.1:3000'; then
    echo "Edge check (auto): nginx-compatible localhost app binding detected."
    return 0
  fi
  if [[ "${traefik_running}" == "true" ]]; then
    echo "Edge check (auto): traefik container is running."
    return 0
  fi

  echo "EDGE check failed (auto mode): neither nginx localhost binding nor running traefik detected." >&2
  print_edge_diagnostics
  return 1
}

timestamp="$(date +%Y%m%d_%H%M%S)"
env_backup="${ENV_FILE_PATH}.bak.${timestamp}"
cp "${ENV_FILE_PATH}" "${env_backup}"

rollback() {
  echo "Deployment failed. Rolling back..."
  cp "${env_backup}" "${ENV_FILE_PATH}"

  up_args=(up -d app worker sms_worker)
  if [[ "${UP_NO_DEPS}" == "true" ]]; then
    up_args=(up -d --no-deps app worker sms_worker)
  fi

  if ! compose_cmd "${up_args[@]}"; then
    echo "Rollback service restart failed. Manual intervention required." >&2
  fi
}

trap rollback ERR

if [[ "${CREATE_DB_BACKUP}" == "true" ]]; then
  auto_clean_conflicts_for_data_services
  ensure_core_services
  if ! mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
    BACKUP_DIR="${APP_DIR}/backups"
    mkdir -p "${BACKUP_DIR}"
  fi
  if ! touch "${BACKUP_DIR}/.write_test" 2>/dev/null; then
    BACKUP_DIR="${APP_DIR}/backups"
    mkdir -p "${BACKUP_DIR}"
  else
    rm -f "${BACKUP_DIR}/.write_test"
  fi
  backup_file="${BACKUP_DIR}/db_${timestamp}.sql"
  echo "Creating database backup: ${backup_file}"
  if [[ -z "$(compose_cmd ps --status running db | awk 'NR>1 {print}')" ]]; then
    echo "Warning: db service is not running; skipping DB backup." >&2
  else
    compose_cmd exec -T db \
      pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${backup_file}"
  fi
fi

if grep -q '^SAIREX_IMAGE=' "${ENV_FILE_PATH}"; then
  sed -i "s|^SAIREX_IMAGE=.*|SAIREX_IMAGE=${IMAGE_REF}|" "${ENV_FILE_PATH}"
else
  echo "SAIREX_IMAGE=${IMAGE_REF}" >> "${ENV_FILE_PATH}"
fi

echo "Validating compose configuration..."
compose_cmd config > /dev/null

echo "Pulling latest images..."
compose_cmd pull app worker sms_worker migrate

if [[ "${CREATE_DB_BACKUP}" != "true" ]]; then
  auto_clean_conflicts_for_data_services
  ensure_core_services
fi

if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
  echo "Running migrations..."
  # Omit --no-deps so Compose waits for db healthcheck before migrate runs.
  compose_cmd run --rm migrate
fi

echo "Starting updated services..."
auto_clean_conflicts_for_app_services
if [[ "${UP_NO_DEPS}" == "true" ]]; then
  compose_cmd up -d --no-deps app worker sms_worker
else
  compose_cmd up -d app worker sms_worker
fi

echo "Waiting for app container health..."
for ((i=1; i<=APP_HEALTH_MAX_CHECKS; i++)); do
  app_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' sairex_app 2>/dev/null || true)"
  echo "Health check ${i}/${APP_HEALTH_MAX_CHECKS}: ${app_health:-unknown}"
  if [[ "${app_health}" == "healthy" || "${app_health}" == "running" ]]; then
    break
  fi
  sleep "${APP_HEALTH_SLEEP_SECONDS}"
done

app_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' sairex_app 2>/dev/null || true)"
if [[ "${app_health}" != "healthy" && "${app_health}" != "running" ]]; then
  echo "App container is not healthy (status: ${app_health})." >&2
  print_app_diagnostics
  exit 1
fi

if [[ -z "$(compose_cmd ps --status running sms_worker | awk 'NR>1 {print}')" ]]; then
  echo "SMS worker is not running." >&2
  exit 1
fi

assert_edge_routing_ready

if [[ "${CREATE_DB_BACKUP}" == "true" ]]; then
  find "${BACKUP_DIR}" -type f -name "db_*.sql" -mtime +"${BACKUP_RETENTION_DAYS}" -delete || true
fi

rm -f "${env_backup}"
trap - ERR
echo "Deployment completed successfully with image: ${IMAGE_REF}"
