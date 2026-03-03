import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  url: z.string().url("Invalid URL"),
  key: z.string().min(1, "Storage key is required"),
  size: z.number().positive(),
  mimeType: z.string().min(1),
  originalName: z.string().optional(),
});

/**
 * POST /api/media/logo/save
 * Records the uploaded logo in MediaAsset and updates Organization.logoUrl.
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

    const { url, key, size, mimeType, originalName } = parsed.data;
    const orgId = resolveOrgId(guard);

    const [asset] = await prisma.$transaction([
      prisma.mediaAsset.create({
        data: {
          organizationId: orgId,
          type: "LOGO",
          url,
          key,
          size,
          mimeType,
          originalName: originalName ?? null,
        },
      }),
      prisma.organization.update({
        where: { id: orgId },
        data: {
          logoUrl: url,
          logoKey: key,
          logoUpdatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Logo save error:", error);
    return NextResponse.json(
      { error: "Failed to save logo" },
      { status: 500 },
    );
  }
}
