import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3 } from "@/lib/s3";

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
    }),
  );
}

export async function deletePrefix(prefix: string): Promise<number> {
  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET!,
      Prefix: prefix,
    }),
  );

  const keys = list.Contents?.map((o) => o.Key).filter(Boolean) ?? [];

  await Promise.all(
    keys.map((key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: key!,
        }),
      ),
    ),
  );

  return keys.length;
}
