# Object storage (S3-compatible)

SairexSMS uses a single **S3-compatible** client so you can run **AWS S3**, **Cloudflare R2**, MinIO, etc., without code changes.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AWS_ACCESS_KEY_ID` | Yes* | API token / access key |
| `AWS_SECRET_ACCESS_KEY` | Yes* | Secret |
| `AWS_S3_BUCKET` | Yes* | Bucket name |
| `AWS_REGION` | For AWS | e.g. `ap-south-1`. For R2 with only `S3_ENDPOINT`, defaults to `auto` in code. |
| `S3_ENDPOINT` or `AWS_ENDPOINT_URL` | R2 / MinIO | e.g. `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `NEXT_PUBLIC_CDN_URL` | Optional | Public base for **logos** and other cacheable assets (R2 custom domain, CloudFront, etc.). |

\*Not required for local dev flows that fall back to data URLs (e.g. onboarding without uploads).

## Cloudflare R2 (recommended pattern)

Repo templates assume bucket **`sairexsmsr2`** (see `infra/server/.env.example` and `web/.env.example`).

1. Create bucket **`sairexsmsr2`** (private) — S3 API enabled.
2. Create R2 API token with read/write on that bucket.
3. Set:

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<r2_access_key_id>
AWS_SECRET_ACCESS_KEY=<r2_secret_access_key>
AWS_S3_BUCKET=sairexsmsr2
AWS_REGION=auto
```

4. For **public logo URLs** in emails/UI, bind a **custom domain** (or R2 public bucket URL) and set on the **server** (no image rebuild):

```env
STORAGE_PUBLIC_BASE_URL=https://cdn.yourdomain.com
```

You can also set `NEXT_PUBLIC_CDN_URL` to the same value if you rebuild images and need it in client bundles.

5. If you use **presigned browser uploads** (`/api/media/logo/upload-url`), add **CORS** on the R2 bucket allowing `PUT` from your app origin.

## Key layout (multi-tenant)

| Prefix | Use |
|--------|-----|
| `tenants/{organizationId}/certificates/` | Legal certs (private; **View** uses signed GET URLs) |
| `tenants/{organizationId}/branding/` | Logo variants |
| `tenants/{organizationId}/invoices/` | Future: invoice PDFs |
| `tenants/{organizationId}/exports/` | Future: exports |
| `tenants/{organizationId}/uploads/` | Future: general uploads |
| `onboarding/users/{userId}/branding/` | Pre-org logo during onboarding |

Helpers: `tenantObjectKey()`, `onboardingUserBrandingPrefix()` in `./paths.ts`.

## API surface

- `getObjectStorage()` — upload, signed GET/PUT, delete, `buildPublicUrl`.
- `parseStoredObjectRef()` — DB may hold legacy `https://`, `data:`, or new object keys (`tenants/...`).

## Legal certificates

After onboarding with storage enabled, `registrationCertificateUrl` / `ntnCertificateUrl` store the **object key**, not a public URL.  
Settings → Profile → **View** calls `GET /api/admin/legal-certificates/signed-url?kind=...` for a short-lived signed URL.
