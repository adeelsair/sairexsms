import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3Client } from "@aws-sdk/client-s3";
import { createS3CompatibleClient } from "./s3-compatible-client";
import { getStorageBucket, getStorageEndpoint, getStorageRegion, isObjectStorageConfigured } from "./env";

export interface UploadObjectParams {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /** For private objects use short cache or private */
  cacheControl?: string;
}

const DEFAULT_GET_TTL_SEC = 15 * 60;
const DEFAULT_PUT_TTL_SEC = 120;

/**
 * S3-compatible storage: AWS S3, Cloudflare R2, MinIO, etc.
 */
export class ObjectStorage {
  private static instance: ObjectStorage | null = null;
  private client: S3Client | null = null;

  static get(): ObjectStorage {
    if (!ObjectStorage.instance) ObjectStorage.instance = new ObjectStorage();
    return ObjectStorage.instance;
  }

  isConfigured(): boolean {
    return isObjectStorageConfigured();
  }

  /** Low-level client for existing call sites that use Command pattern. */
  getClient(): S3Client {
    if (!this.isConfigured()) {
      throw new Error(
        "Object storage is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION (or S3_ENDPOINT for R2).",
      );
    }
    if (!this.client) this.client = createS3CompatibleClient();
    return this.client;
  }

  getBucket(): string {
    return getStorageBucket();
  }

  /**
   * Public URL for objects meant to be cacheable via CDN (e.g. logos when bucket/path is public).
   * Prefer `STORAGE_PUBLIC_BASE_URL` on the server (read at runtime — no Docker rebuild).
   * `NEXT_PUBLIC_CDN_URL` is also supported but is inlined at `next build` for client bundles.
   */
  buildPublicUrl(key: string): string {
    const cdnBase = (
      process.env.STORAGE_PUBLIC_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_CDN_URL?.trim() ||
      ""
    ).replace(/\/+$/, "");
    if (cdnBase) return `${cdnBase}/${key}`;
    const bucket = this.getBucket();
    const region = getStorageRegion();
    const endpoint = getStorageEndpoint();
    if (endpoint) {
      const base = endpoint.replace(/\/+$/, "");
      return `${base}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async uploadObject(params: UploadObjectParams): Promise<void> {
    const input: PutObjectCommandInput = {
      Bucket: this.getBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    };
    if (params.cacheControl) input.CacheControl = params.cacheControl;
    await this.getClient().send(new PutObjectCommand(input));
  }

  async getSignedGetUrl(key: string, expiresInSec: number = DEFAULT_GET_TTL_SEC): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
    });
    return getSignedUrl(this.getClient(), command, { expiresIn: expiresInSec });
  }

  async getSignedPutUrl(
    key: string,
    contentType: string,
    expiresInSec: number = DEFAULT_PUT_TTL_SEC,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.getBucket(),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.getClient(), command, { expiresIn: expiresInSec });
  }

  async deleteObject(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.getBucket(),
        Key: key,
      }),
    );
  }

  async deletePrefix(prefix: string): Promise<number> {
    const list = await this.getClient().send(
      new ListObjectsV2Command({
        Bucket: this.getBucket(),
        Prefix: prefix,
      }),
    );
    const keys = list.Contents?.map((o) => o.Key).filter(Boolean) ?? [];
    await Promise.all(keys.map((k) => this.deleteObject(k!)));
    return keys.length;
  }
}

export function getObjectStorage(): ObjectStorage {
  return ObjectStorage.get();
}
