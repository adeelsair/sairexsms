/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, etc.)
 *
 * R2: set S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *      and AWS_REGION=auto (or omit; we default to "auto" when endpoint is set).
 */

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.AWS_S3_BUCKET?.trim(),
  );
}

export function getStorageBucket(): string {
  const b = process.env.AWS_S3_BUCKET?.trim();
  if (!b) throw new Error("AWS_S3_BUCKET is not set");
  return b;
}

/** Custom endpoint for R2 / MinIO (optional for AWS S3). */
export function getStorageEndpoint(): string | undefined {
  const a = process.env.S3_ENDPOINT?.trim();
  const b = process.env.AWS_ENDPOINT_URL?.trim();
  return a || b || undefined;
}

export function getStorageRegion(): string {
  const r = process.env.AWS_REGION?.trim();
  if (r) return r;
  return getStorageEndpoint() ? "auto" : "us-east-1";
}
