# Release Sync Runbook

This runbook keeps local, GitHub, and production aligned for each release.

## 0) Preconditions

- You are on `main` locally.
- `gh` CLI is authenticated.
- Production deploy workflow is available.
- Production server env is configured for auth verification parity:
  - `NEXTAUTH_URL` points to the public domain.
  - SMTP vars are set (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
  - SMS vars are set for selected provider (`SMS_PROVIDER` + provider credentials).
  - `SMS_DRY_RUN` is disabled for real OTP sends.
  - Queue workers are running (OTP/email jobs are processed).
- Production edge mode is set for deploy safety checks:
  - `EDGE_ROUTER_MODE=nginx` for host nginx reverse proxy to app on `127.0.0.1:3000`.
  - `EDGE_ROUTER_MODE=traefik` for containerized Traefik edge.
  - `EDGE_ROUTER_MODE=auto` if both patterns may exist.

## 1) Local pre-flight

Run from `c:\SairexSMS\web`:

```powershell
git fetch origin main
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected:

- Working tree is clean.
- `HEAD` equals `origin/main` before release (or you intentionally have new commits to push).

## 2) Database schema parity (local)

```powershell
npx dotenv -e .env.local -- npx prisma migrate status --schema ../prisma/schema.prisma
npx dotenv -e .env.local -- npx prisma migrate deploy --schema ../prisma/schema.prisma
```

Expected:

- No pending migrations.

## 3) Push release commit

```powershell
git push origin main
```

## 4) Verify build pipeline (Docker)

```powershell
gh run list --workflow "Docker" --limit 5
```

Expected:

- Latest run for `main` is `completed success`.

## 5) Deploy production

Default safe deploy:

```powershell
gh workflow run "Deploy Production" --ref main -f image_tag=latest -f run_migrations=true -f create_db_backup=true
```

If infra is unstable and you must preserve current server state:

```powershell
gh workflow run "Deploy Production" --ref main -f image_tag=latest -f run_migrations=false -f create_db_backup=false
```

Then watch:

```powershell
gh run list --workflow "Deploy Production" --limit 1
```

## 6) Post-deploy checks

Minimum smoke checks:

- Super admin login works.
- Org list loads (no `Failed to fetch orgs`).
- Dev-tools page loads (no `Failed to load dev-tools data`).
- Admin dashboard loads.
- New user signup sends verification email.
- Email verification link opens app domain and activates account.
- Phone OTP request enqueues and OTP arrives by SMS.
- OTP verification succeeds and user can continue flow.

## 7) If deploy fails

Inspect failed logs:

```powershell
gh run view <run_id> --log-failed
```

Common current infra issue:

- Container name conflict (`*_db`, `*_redis` already in use).
- Edge mismatch (deploy healthy, external `502 Bad Gateway`):
  - If using host nginx, ensure `proxy_pass http://127.0.0.1:3000;`
  - Ensure deploy env has `EDGE_ROUTER_MODE=nginx`.
  - If using Traefik edge, set `EDGE_ROUTER_MODE=traefik`.

If seen, resolve on server in maintenance window before retrying deploy.

