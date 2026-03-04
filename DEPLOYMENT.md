# SairexSMS Deployment Pipeline Notes

## Phase D2 Step 2: Container Registry (GHCR)

This repository publishes a production image to GHCR using GitHub Actions.

### Published image

- `ghcr.io/<github-org-or-user>/sairexsms-ops:latest` (default branch only)
- `ghcr.io/<github-org-or-user>/sairexsms-ops:sha-<short-sha>`
- `ghcr.io/<github-org-or-user>/sairexsms-ops:<git-tag>` (for tag pushes)

Workflow file: `.github/workflows/publish-image.yml`

## Runtime image selection

`docker-compose.yml` production-profile services (`migrate`, `app`, `worker`) now use:

`SAIREX_IMAGE` (with fallback):

`image: ${SAIREX_IMAGE:-sairexsms-ops:latest}`

This keeps local defaults while allowing immutable registry deployments on servers.

## Server usage

Set image in server `.env` (or deployment environment):

```env
SAIREX_IMAGE=ghcr.io/<github-org-or-user>/sairexsms-ops:latest
```

Then deploy:

```bash
docker compose --profile prod pull
docker compose --profile prod up -d
```

For deterministic rollback, pin to a SHA tag:

```env
SAIREX_IMAGE=ghcr.io/<github-org-or-user>/sairexsms-ops:sha-<short-sha>
```

## Phase D2 Step 3: Production Server Runtime Structure

Production runtime templates are now defined under:

- `infra/server/docker-compose.prod.yml`
- `infra/server/.env.example`
- `infra/server/README.md`

The layout is standardized for:

```text
/opt/sairex
 ├── docker-compose.yml
 ├── .env
 └── volumes/
      ├── postgres/
      └── redis/
```

Key runtime properties:

- pull-only runtime image (`SAIREX_IMAGE` from GHCR)
- no build steps on server
- restart policies on long-running services
- persistent bind volumes for Postgres/Redis
- one-command boot/update (`docker compose pull && docker compose up -d`)

## Phase D2 Step 4: Zero-Downtime Deployment Flow

Deployment script template:

- `infra/server/deploy.sh`

Server runtime usage:

```bash
cd /opt/sairex
./deploy.sh
```

Deployment order (implemented in script):

1. Pull latest image tags
2. Run one-shot Prisma migration
3. Restart `app` and `worker` on new image
4. Prune dangling images

This keeps schema + runtime in sync and avoids server-side image rebuilds.

## Phase D2 Step 5: Domain + HTTPS + Reverse Proxy (Traefik)

Production server runtime now includes Traefik in:

- `infra/server/docker-compose.prod.yml`

Implemented capabilities:

- automatic TLS via Let's Encrypt (ACME TLS challenge)
- Docker provider routing via labels
- HTTPS entrypoint (`:443`) and HTTP entrypoint (`:80`)
- app host routing with `SAIREX_APP_DOMAIN`

Required server prep:

- DNS `A` record: `app -> <server-ip>`
- `/opt/sairex/letsencrypt/acme.json` created with `chmod 600`
- `.env` includes:
  - `SAIREX_APP_DOMAIN=app.sairexsms.com`
  - `TRAEFIK_ACME_EMAIL=<your-email>`

First secure boot:

```bash
docker compose pull
docker compose up -d
```

## Phase D3 Step 1: CI/CD Auto Deploy (GitHub -> VPS)

Workflow:

- `.github/workflows/deploy.yml`

Flow on push to `main`/`master`:

1. Build `ops-runner` image
2. Push to GHCR as:
   - `latest`
   - `sha-${GITHUB_SHA}`
3. SSH to VPS
4. Run `/opt/sairex/deploy.sh` with `SAIREX_IMAGE` pinned to commit SHA tag

Required GitHub Actions secrets:

- `VPS_HOST` -> server IP / hostname
- `VPS_USER` -> deploy user (for example `root`)
- `VPS_SSH_KEY` -> private SSH key

Server prep requirement:

- corresponding public key added to `~/.ssh/authorized_keys` for `VPS_USER`

Notes:

- `publish-image.yml` is kept for tag/manual publishing (release tags)
- `deploy.yml` handles continuous delivery from default branches

## Phase D3 Step 2: Automated Pre-Deploy Database Backup

Deploy script now includes automated Postgres backup before pulling images:

- `infra/server/deploy.sh`

Implemented behavior:

1. Create timestamped backup file:
   - `/opt/sairex/backups/db_<timestamp>.sql`
2. Pull new image tags
3. Run migration job
4. Restart app + worker
5. Prune dangling images
6. Remove old backups older than `BACKUP_RETENTION_DAYS` (default: `7`)

Config knobs:

- `POSTGRES_USER` (default `sairex`)
- `POSTGRES_DB` (default `sairex`)
- `BACKUP_RETENTION_DAYS` (default `7`)

Restore pattern:

```bash
cat /opt/sairex/backups/db_YYYYMMDD_HHMMSS.sql | docker compose exec -T db psql -U sairex -d sairex
```

## Phase D3 Step 3: Health Checks + Uptime Monitoring + Structured Logs

Runtime monitoring is now wired in `infra/server/docker-compose.prod.yml`:

- `app` healthcheck:
  - `wget -qO- http://localhost:3000/api/health`
- `worker` healthcheck:
  - `node -e "process.exit(0)"`
- structured JSON logs with rotation for `app` and `worker`:
  - `max-size: 10m`
  - `max-file: 3`
- `uptime_kuma` service:
  - port `3001`
  - persistent data at `./volumes/uptime-kuma`

Operational checks:

```bash
docker ps
```

Uptime monitor target:

```text
https://app.sairexsms.com/api/health
```

## Phase D3 Step 4: Queue Visibility + Metrics Foundation + Scale Readiness

Queue observability:

- Admin dashboard route: `/admin/queues`
- API source: `/api/queues`
- Uses BullMQ job counts for all platform queues (waiting/active/delayed/failed/completed)

Runtime scale-readiness:

- resource limits added in `infra/server/docker-compose.prod.yml` for:
  - `traefik`
  - `app`
  - `worker`
  - `db`
  - `redis`
  - `uptime_kuma`

Horizontal worker scale command:

```bash
docker compose up -d --scale worker=3
```
