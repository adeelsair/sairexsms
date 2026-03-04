import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { assertOwnership } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campuses/:id
 */
export async function GET(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  const campusId = parseInt(id, 10);
  if (isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid campus ID" }, { status: 400 });
  }

  try {
    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      include: {
        organization: { select: { id: true, organizationName: true } },
        city: { select: { id: true, name: true, unitCode: true } },
        zone: { select: { id: true, name: true, unitCode: true } },
      },
    });

    if (!campus) {
      return NextResponse.json({ error: "Campus not found" }, { status: 404 });
    }

    if (!isSuperAdmin(guard)) {
      const ownershipCheck = assertOwnership(guard, campus.organizationId);
      if (ownershipCheck) return ownershipCheck;
    }

    return NextResponse.json(campus);
  } catch (error) {
    console.error("Campus fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch campus" }, { status: 500 });
  }
}

/**
 * PUT /api/campuses/:id
 * Update campus fields. Blocks archiving of the main campus.
 */
export async function PUT(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  const campusId = parseInt(id, 10);
  if (isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid campus ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, organizationId: true, isMainCampus: true },
    });

    if (!campus) {
      return NextResponse.json({ error: "Campus not found" }, { status: 404 });
    }

    if (!isSuperAdmin(guard)) {
      const ownershipCheck = assertOwnership(guard, campus.organizationId);
      if (ownershipCheck) return ownershipCheck;
    }

    if (campus.isMainCampus && body.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Main campus cannot be archived" },
        { status: 403 },
      );
    }

    if (campus.isMainCampus && body.isMainCampus === false) {
      return NextResponse.json(
        { error: "Cannot demote the main campus" },
        { status: 403 },
      );
    }

    const updated = await prisma.campus.update({
      where: { id: campusId },
      data: {
        name: body.name,
        address: body.address ?? undefined,
        principalName: body.principalName ?? undefined,
        contactPhone: body.contactPhone ?? undefined,
        email: body.email ?? undefined,
        status: body.status ?? undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Campus update error:", error);
    return NextResponse.json({ error: "Failed to update campus" }, { status: 500 });
  }
}

/**
 * DELETE /api/campuses/:id
 * Soft-delete. Blocks deletion of the main campus.
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  const campusId = parseInt(id, 10);
  if (isNaN(campusId)) {
    return NextResponse.json({ error: "Invalid campus ID" }, { status: 400 });
  }

  try {
    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, organizationId: true, isMainCampus: true },
    });

    if (!campus) {
      return NextResponse.json({ error: "Campus not found" }, { status: 404 });
    }

    if (!isSuperAdmin(guard)) {
      const ownershipCheck = assertOwnership(guard, campus.organizationId);
      if (ownershipCheck) return ownershipCheck;
    }

    if (campus.isMainCampus) {
      return NextResponse.json(
        { error: "Main campus cannot be deleted" },
        { status: 403 },
      );
    }

    await prisma.campus.update({
      where: { id: campusId },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Campus delete error:", error);
    return NextResponse.json({ error: "Failed to delete campus" }, { status: 500 });
  }
}
