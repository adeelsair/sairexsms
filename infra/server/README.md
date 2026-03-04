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

## Deploy lifecycle

`deploy.sh` runs a tenant-safe release order:

1. Pre-deploy Postgres backup to `/opt/sairex/backups/db_<timestamp>.sql`
2. `docker compose pull`
3. `docker compose run --rm migrate`
4. `docker compose up -d app worker`
5. `docker image prune -f`
6. Delete backups older than `BACKUP_RETENTION_DAYS`

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
