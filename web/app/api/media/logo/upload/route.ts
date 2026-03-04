import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { resolveOrgId } from "@/lib/tenant";
import { validateImage, generateVariants, deletePrefix } from "@/lib/media";

function buildUrl(key: string): string {
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL;
  return cdnBase
    ? `${cdnBase}/${key}`
    : `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * POST /api/media/logo/upload
 * Accepts multipart FormData with: file.
 * Validates, generates WEBP variants, uploads to S3, records MediaAsset rows.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const orgId = resolveOrgId(guard);
    const buffer = Buffer.from(await file.arrayBuffer());

    const meta = await validateImage(buffer, file.size);

    const variants = await generateVariants(buffer, meta.width, meta.height);

    const nextVersion = await getNextVersion(orgId);
    const versionTag = `v${nextVersion}`;
    const basePath = `organizations/${orgId}/branding`;

    await deletePrefix(`${basePath}/`);

    const savedAssets: { variant: string; url: string; key: string }[] = [];

    for (const v of variants) {
      const key = `${basePath}/logo_${versionTag}_${v.variant.toLowerCase()}.webp`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: key,
          Body: v.buffer,
          ContentType: v.mimeType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );

      savedAssets.push({ variant: v.variant, url: buildUrl(key), key });
    }

    const assetCreates = savedAssets.map((a, i) =>
      prisma.mediaAsset.create({
        data: {
          organizationId: orgId,
          type: "LOGO",
          variant: variants[i].variant,
          url: a.url,
          key: a.key,
          size: variants[i].size,
          mimeType: variants[i].mimeType,
          width: variants[i].width,
          height: variants[i].height,
          originalName: file.name,
          createdBy: String(guard.id),
          version: nextVersion,
        },
      }),
    );

    const originalAsset = savedAssets.find((a) => a.variant === "ORIGINAL");
    const mdAsset = savedAssets.find((a) => a.variant === "MD");
    const logoUrl = mdAsset?.url ?? originalAsset?.url ?? savedAssets[0]?.url;

    const orgUpdate = prisma.organization.update({
      where: { id: orgId },
      data: {
        logoUrl,
        logoKey: originalAsset?.key ?? savedAssets[0]?.key,
        logoUpdatedAt: new Date(),
        logoLightUrl: logoUrl,
      },
    });

    await prisma.$transaction([...assetCreates, orgUpdate]);

    return NextResponse.json({
      version: nextVersion,
      logoUrl,
      variants: savedAssets.map((a) => ({
        variant: a.variant,
        url: a.url,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Logo upload failed";
    console.error("Logo upload error:", error);

    if (msg.includes("too small") || msg.includes("too large") || msg.includes("Unsupported") || msg.includes("Invalid")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getNextVersion(orgId: string): Promise<number> {
  const latest = await prisma.mediaAsset.findFirst({
    where: { organizationId: orgId, type: "LOGO" },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}
