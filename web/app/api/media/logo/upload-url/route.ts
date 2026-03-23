import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { resolveOrgId } from "@/lib/tenant";
import { getObjectStorage, isObjectStorageConfigured, tenantObjectKey } from "@/lib/storage";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  fileType: z.string().refine((t) => ALLOWED_TYPES.includes(t), "Unsupported file type"),
  fileSize: z.number().max(MAX_SIZE, "File too large (max 5 MB)"),
});

/**
 * POST /api/media/logo/upload-url
 * Returns a pre-signed S3 PUT URL for direct browser upload.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (!isObjectStorageConfigured()) {
      return NextResponse.json(
        { error: "Object storage is not configured for direct uploads." },
        { status: 503 },
      );
    }

    const { fileType } = parsed.data;
    const orgId = resolveOrgId(guard);

    const ext = fileType.split("/")[1] === "svg+xml" ? "svg" : fileType.split("/")[1];
    const key = `${tenantObjectKey(orgId, "branding")}/logo_${Date.now()}.${ext}`;

    const storage = getObjectStorage();
    const uploadUrl = await storage.getSignedPutUrl(key, fileType);
    const fileUrl = storage.buildPublicUrl(key);

    return NextResponse.json({ uploadUrl, fileUrl, key });
  } catch (error) {
    console.error("Logo upload-url error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
