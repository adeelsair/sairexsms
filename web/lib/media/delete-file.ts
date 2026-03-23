import { getObjectStorage } from "@/lib/storage";

export async function deleteFile(key: string): Promise<void> {
  await getObjectStorage().deleteObject(key);
}

export async function deletePrefix(prefix: string): Promise<number> {
  return getObjectStorage().deletePrefix(prefix);
}
