import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { resolveOrgId, assertOwnership } from "@/lib/tenant";
import { assertCanCreateGeo } from "@/lib/org-structure";

type RouteContext = { params: Promise<{ id: string }> };

const GEO_LOCKED_ERROR = {
  error: "Geo hierarchy is disabled for single-structure organizations",
  code: "SINGLE_STRUCTURE_GEO_LOCKED",
} as const;

/**
 * Resolve the geo entity by ID across all geo tables.
 * Returns the record + its table type, or null.
 */
async function findGeoEntity(id: string) {
  const region = await prisma.region.findUnique({ where: { id }, select: { id: true, organizationId: true, name: true } });
  if (region) return { ...region, geoType: "region" as const };

  const subRegion = await prisma.subRegion.findUnique({ where: { id }, select: { id: true, organizationId: true, name: true } });
  if (subRegion) return { ...subRegion, geoType: "subRegion" as const };

  const city = await prisma.city.findUnique({ where: { id }, select: { id: true, organizationId: true, name: true } });
  if (city) return { ...city, geoType: "city" as const };

  const zone = await prisma.zone.findUnique({ where: { id }, select: { id: true, organizationId: true, name: true } });
  if (zone) return { ...zone, geoType: "zone" as const };

  return null;
}

/**
 * PUT /api/regions/:id
 * Update a geo entity's name. Blocked for SINGLE-structure orgs.
 */
export async function PUT(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;

  try {
    const entity = await findGeoEntity(id);
    if (!entity) {
      return NextResponse.json({ error: "Geo entity not found" }, { status: 404 });
    }

    if (!isSuperAdmin(guard)) {
      const ownershipCheck = assertOwnership(guard, entity.organizationId);
      if (ownershipCheck) return ownershipCheck;
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: entity.organizationId },
      select: { organizationStructure: true },
    });

    try {
      assertCanCreateGeo(org);
    } catch {
      return NextResponse.json(GEO_LOCKED_ERROR, { status: 403 });
    }

    const body = await request.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let updated;
    switch (entity.geoType) {
      case "region":
        updated = await prisma.region.update({ where: { id }, data: { name } });
        break;
      case "subRegion":
        updated = await prisma.subRegion.update({ where: { id }, data: { name } });
        break;
      case "city":
        updated = await prisma.city.update({ where: { id }, data: { name } });
        break;
      case "zone":
        updated = await prisma.zone.update({ where: { id }, data: { name } });
        break;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Geo entity update error:", error);
    return NextResponse.json({ error: "Failed to update geo entity" }, { status: 500 });
  }
}

/**
 * DELETE /api/regions/:id
 * Soft-delete (archive) a geo entity. Blocked for SINGLE-structure orgs.
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;

  try {
    const entity = await findGeoEntity(id);
    if (!entity) {
      return NextResponse.json({ error: "Geo entity not found" }, { status: 404 });
    }

    if (!isSuperAdmin(guard)) {
      const ownershipCheck = assertOwnership(guard, entity.organizationId);
      if (ownershipCheck) return ownershipCheck;
    }

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: entity.organizationId },
      select: { organizationStructure: true },
    });

    try {
      assertCanCreateGeo(org);
    } catch {
      return NextResponse.json(GEO_LOCKED_ERROR, { status: 403 });
    }

    switch (entity.geoType) {
      case "region":
        await prisma.region.update({ where: { id }, data: { status: "ARCHIVED" } });
        break;
      case "subRegion":
        await prisma.subRegion.update({ where: { id }, data: { status: "ARCHIVED" } });
        break;
      case "city":
        await prisma.city.update({ where: { id }, data: { status: "ARCHIVED" } });
        break;
      case "zone":
        await prisma.zone.update({ where: { id }, data: { status: "ARCHIVED" } });
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Geo entity delete error:", error);
    return NextResponse.json({ error: "Failed to delete geo entity" }, { status: 500 });
  }
}
