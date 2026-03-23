# SairexSMS Server Runtime (Phase D2 Step 3)

This directory defines the production server runtime structure for VPS/Coolify-style deployments.

## Target server layout

```text
/opt/sairex
 ├── docker-compose.yml
 ├── .env
 ├── deploy.sh
 ├── letsencrypt/
 ├── backups/
 └── volumes/
      ├── postgres/
      └── redis/
      └── uptime-kuma/
```

## Setup on server

1. Create runtime directory:

```bash
sudo mkdir -p /opt/sairex/letsencrypt /opt/sairex/backups /opt/sairex/volumes/postgres /opt/sairex/volumes/redis /opt/sairex/volumes/uptime-kuma
sudo touch /opt/sairex/letsencrypt/acme.json
sudo chmod 600 /opt/sairex/letsencrypt/acme.json
```

2. Copy compose template:

```bash
cp infra/server/docker-compose.prod.yml /opt/sairex/docker-compose.yml
```

3. Create environment file:

```bash
cp infra/server/.env.example /opt/sairex/.env
```

Then edit `/opt/sairex/.env` with real secrets and GHCR image reference.

Also set:

- `SAIREX_APP_DOMAIN` (example: `app.sairexsms.com`)
- `TRAEFIK_ACME_EMAIL` (email for Let's Encrypt registration)
- `BACKUP_RETENTION_DAYS` (default `7`)

### Cloudflare R2 (object storage)

Default bucket name in `.env.example` is **`sairexsmsr2`**. Set:

- `S3_ENDPOINT` — from R2 → **S3 API** (ends with `.r2.cloudflarestorage.com`)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — R2 API token
- `AWS_S3_BUCKET=sairexsmsr2`, `AWS_REGION=auto`

Optional: `NEXT_PUBLIC_CDN_URL` — public origin for **logos** (custom domain on the bucket).  
Certificates use **signed URLs** and stay private in the bucket.

See **`docs/object-storage.md`**, **`docs/r2-server-setup.md`**, **`web/lib/storage/README.md`**, and paste-ready **`infra/server/snippets/r2-object-storage.env`**.

4. Copy deploy script:

```bash
cp infra/server/deploy.sh /opt/sairex/deploy.sh
chmod +x /opt/sairex/deploy.sh
```

## First server boot

```bash
cd /opt/sairex
docker compose pull
docker compose up -d
```

## DNS requirement

Create an `A` record before first secure boot:

- Host: `app`
- Value: `<YOUR_SERVER_IP>`

Then wait for DNS propagation.

## Optional local template validation

```bash
SAIREX_ENV_FILE=.env.example docker compose -f infra/server/docker-compose.prod.yml config
```

## Update flow (same layout)

```bash
cd /opt/sairex
./deploy.sh
```

To pin deterministic rollback, set:

```env
SAIREX_IMAGE=ghcr.io/<owner>/sairexsms-ops:sha-<short-sha>
```

## Backup & restore (DR)

See **`docs/backup-restore.md`**:

- **`scripts/backup-stack.sh`** — Postgres + Redis + config archive (optional `rclone`).
- **`scripts/restore-stack.sh`** — destructive restore (guarded by env vars).

Pre-deploy **SQL-only** snapshots remain in **`deploy-safe.sh`**.

## Deploy lifecycle

`deploy.sh` runs a tenant-safe release order:

1. Pre-deploy Postgres backup to `/opt/sairex/backups/db_<timestamp>.sql`
2. `docker compose pull`
3. `docker compose run --rm migrate`
4. `docker compose up -d app worker`
5. `docker image prune -f`
6. Delete backups older than `BACKUP_RETENTION_DAYS`

**GitHub Actions production deploy** uses `infra/server/deploy-safe.sh` from the repo (not necessarily `/opt/sairex/deploy.sh`). That script:

- Defaults **`AUTO_CLEAN_DATA_SERVICES=false`** so **db/redis containers are not removed on every release** (avoids Postgres recovery + Redis cold start taking the API down).
- Waits for **`pg_isready`** and **Redis `PING`** before backup/migrate.
- Uses **`docker compose run --rm migrate`** without `--no-deps` so migrations run only after the DB healthcheck passes.

See `DEPLOYMENT.md` → **Reliable deploys** for details. Set `AUTO_CLEAN_DATA_SERVICES=true` only when fixing a one-off container name conflict.

## Operations (disk, cron, security)

Production hardening and **what to run on the server** (cron, disk alerts, SSH, fail2ban, stash cleanup) lives in:

- **`docs/production-ops-checklist.md`**

Helper scripts (copy with repo; `chmod +x` on the server):

- **`infra/server/scripts/bootstrap-server-automation.sh`** — **one-command** safe cron/fail2ban/journal/nginx setup (see checklist).
- **`infra/server/scripts/docker-prune-safe.sh`** — weekly Docker cleanup without touching volumes.
- **`infra/server/scripts/disk-alert.sh`** — fail when `/` usage exceeds a threshold.
- **`infra/server/scripts/nginx-reload-if-ok.sh`** — `nginx -t` + reload if nginx is present.

## HTTPS verification

After the first secure boot (30-60s):

```text
https://app.sairexsms.com
```

You should see a valid TLS certificate issued by Let's Encrypt.

## Health and monitoring

App health endpoint (already implemented in app):

```text
https://app.sairexsms.com/api/health
```

Container health status:

```bash
docker ps
```

You should see `healthy` / `starting` states for services with health checks.

Uptime Kuma dashboard:

```text
http://<YOUR_SERVER_IP>:3001
```

Recommended monitor target:

```text
https://app.sairexsms.com/api/health
```

## Queue observability and scale

Queue dashboard route:

```text
https://app.sairexsms.com/admin/queues
```

Horizontal worker scale test:

```bash
cd /opt/sairex
docker compose up -d --scale worker=3
```

## Backup verification

After running `./deploy.sh`:

```bash
ls /opt/sairex/backups
```

You should see files like:

```text
db_20260228_123456.sql
```

## Restore example

```bash
cat /opt/sairex/backups/db_YYYYMMDD_HHMMSS.sql | docker compose exec -T db psql -U sairex -d sairex
```
