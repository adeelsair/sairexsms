import { S3Client } from "@aws-sdk/client-s3";
import { getStorageEndpoint, getStorageRegion } from "./env";

/**
 * Single factory for all S3-compatible providers (AWS S3, Cloudflare R2, MinIO).
 */
export function createS3CompatibleClient(): S3Client {
  const endpoint = getStorageEndpoint();
  const region = getStorageRegion();

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    /**
     * Path-style URLs work across R2 and many MinIO setups.
     * AWS S3 virtual-hosted style also works with endpoint unset.
     */
    forcePathStyle: Boolean(endpoint),
  });
}
