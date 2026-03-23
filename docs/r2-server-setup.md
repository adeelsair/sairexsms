# Configure production server for Cloudflare R2

Your app reads object storage settings from the **same env file** Docker uses:  
`infra/server/server.env.live` (fallback: `infra/server/.env`).

GitHub Actions deploy does **not** inject R2 secrets — you add them **once on the VPS**.

---

## 1. Cloudflare (one-time)

1. Bucket **`sairexsmsr2`** — S3 API enabled ✓  
2. **R2 → Manage R2 API Tokens** — create token with **Object Read & Write** on that bucket.  
3. **R2 → Overview → S3 API** — copy:
   - **Endpoint** → `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`  
4. (Recommended for logos) Attach a **public access** hostname:
   - Custom domain or **R2.dev subdomain** on the bucket → use that as `STORAGE_PUBLIC_BASE_URL` below.

---

## 2. On the VPS

```bash
ssh your-user@your-server
cd /path/to/SairexSMS   # e.g. /home/sairex/SairexSMS — same as PROD_APP_DIR
```

Open the live env file (create it if missing — you can start from `infra/server/.env.example`):

```bash
nano infra/server/server.env.live
```

Append the block from **[`infra/server/snippets/r2-object-storage.env`](../infra/server/snippets/r2-object-storage.env)** and replace:

| Placeholder | Replace with |
|-------------|----------------|
| `YOUR_CLOUDFLARE_ACCOUNT_ID` | From R2 S3 API URL |
| `YOUR_R2_ACCESS_KEY_ID` / `YOUR_R2_SECRET_ACCESS_KEY` | From API token |
| `STORAGE_PUBLIC_BASE_URL` | Your **public** logo URL origin (no trailing slash) |

Save the file.

---

## 3. Apply (pick one)

**A) Next deploy** — push to `main` / run **Deploy Production**; containers restart with new env.

**B) Immediate restart** (no git change):

```bash
cd /path/to/SairexSMS
docker compose -f infra/server/docker-compose.prod.yml \
  --env-file infra/server/server.env.live \
  restart app worker sms_worker
```

(Adjust service names if your compose differs.)

---

## 4. Verify

- Upload a **logo** (admin / onboarding) → object appears in R2 under `tenants/<orgId>/branding/`.  
- Complete or view **certificates** → keys under `tenants/<orgId>/certificates/`; **View** uses signed URLs.

---

## 5. Why `STORAGE_PUBLIC_BASE_URL`?

Logo URLs are built in API routes using **`STORAGE_PUBLIC_BASE_URL`** first, then **`NEXT_PUBLIC_CDN_URL`**.  
Using **`STORAGE_PUBLIC_BASE_URL` on the server** avoids needing a **new Docker image** when you only change the public CDN hostname.

---

## Reference

- [`web/lib/storage/README.md`](../web/lib/storage/README.md)  
- [`docs/object-storage.md`](object-storage.md)  
- [`infra/server/.env.example`](../infra/server/.env.example)
