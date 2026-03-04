import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  version: z.number().int().positive("Version must be a positive integer"),
});

/**
 * POST /api/media/logo/rollback
 * Rolls back to a previous logo version by updating Organization fields.
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

    const { version } = parsed.data;
    const orgId = resolveOrgId(guard);

    const assets = await prisma.mediaAsset.findMany({
      where: { organizationId: orgId, type: "LOGO", version },
      orderBy: { variant: "asc" },
    });

    if (assets.length === 0) {
      return NextResponse.json(
        { error: `No logo assets found for version ${version}` },
        { status: 404 },
      );
    }

    const original = assets.find((a) => a.variant === "ORIGINAL");
    const md = assets.find((a) => a.variant === "MD");
    const logoUrl = md?.url ?? original?.url ?? assets[0].url;

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        logoUrl,
        logoKey: original?.key ?? assets[0].key,
        logoUpdatedAt: new Date(),
        logoLightUrl: logoUrl,
      },
    });

    return NextResponse.json({
      version,
      logoUrl,
      variants: assets.map((a) => ({ variant: a.variant, url: a.url })),
    });
  } catch (error) {
    console.error("Logo rollback error:", error);
    return NextResponse.json(
      { error: "Failed to rollback logo" },
      { status: 500 },
    );
  }
}
