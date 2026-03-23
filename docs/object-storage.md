# Object storage (S3 / R2)

SairexSMS uses an **S3-compatible** abstraction (`web/lib/storage/`) for AWS S3, **Cloudflare R2**, MinIO, etc.

Full variable reference and key layout: [`web/lib/storage/README.md`](../web/lib/storage/README.md).

## Cloudflare R2 (configured bucket: `sairexsmsr2`)

Templates in the repo use bucket **`sairexsmsr2`**. On the server, set:

| Variable | Value |
|----------|--------|
| `AWS_S3_BUCKET` | `sairexsmsr2` |
| `AWS_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (from R2 S3 API page) |
| `AWS_ACCESS_KEY_ID` | R2 API token access key |
| `AWS_SECRET_ACCESS_KEY` | R2 API token secret |

Copy from [`infra/server/.env.example`](../infra/server/.env.example) and replace `YOUR_*` placeholders. For local Next dev, see [`web/.env.example`](../web/.env.example).

**Public logos:** set **`STORAGE_PUBLIC_BASE_URL`** on the server (preferred — no Docker rebuild) or `NEXT_PUBLIC_CDN_URL` (baked at build) to your R2 public hostname so `<img src={logoUrl}>` and emails resolve. Step-by-step: [`docs/r2-server-setup.md`](r2-server-setup.md).

**Private legal certificates:** stored under `tenants/{orgId}/certificates/` as **keys**; the app issues **signed GET URLs** via `GET /api/admin/legal-certificates/signed-url`.

## AWS S3 instead

Unset `S3_ENDPOINT`, set `AWS_REGION` to your region (e.g. `ap-south-1`), and use an AWS access key scoped to the target bucket.
