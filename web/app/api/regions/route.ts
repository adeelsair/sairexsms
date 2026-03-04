import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { resolveOrgId } from "@/lib/tenant";
import { assertCanCreateGeo } from "@/lib/org-structure";
import { generateUnitCode, generateCityCode } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import {
  assignableRegionsWhere,
  assignableSubRegionsWhere,
  assignableZonesWhere,
} from "@/lib/rbac/assignable-scope";

/**
 * GET /api/regions
 * Returns the geo hierarchy scoped to the caller's organization.
 *
 * GET /api/regions?assignable=true&forRole=SUBREGION_ADMIN
 * Returns only units the current user is allowed to assign for the given role.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const assignable = searchParams.get("assignable");
    const forRole = searchParams.get("forRole");

    if (assignable === "true" && forRole) {
      return handleAssignable(guard, forRole);
    }

    const orgId = guard.organizationId || "";

    if (!orgId) {
      return NextResponse.json(
        { error: "organizationId could not be resolved" },
        { status: 400 },
      );
    }

    const orgFilter = { organizationId: orgId, status: "ACTIVE" as const };

    const [regions, subRegions, cities, zones] = await Promise.all([
      prisma.region.findMany({ where: orgFilter, orderBy: { name: "asc" } }),
      prisma.subRegion.findMany({ where: orgFilter, orderBy: { name: "asc" } }),
      prisma.city.findMany({ where: orgFilter, orderBy: { name: "asc" } }),
      prisma.zone.findMany({ where: orgFilter, orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ regions, subRegions, cities, zones });
  } catch (error) {
    console.error("Geo hierarchy fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch geo hierarchy" },
      { status: 500 },
    );
  }
}

async function handleAssignable(
  guard: Exclude<Awaited<ReturnType<typeof requireAuth>>, NextResponse>,
  forRole: string,
) {
  if (guard.organizationStructure === "SINGLE") {
    return NextResponse.json({ ok: true, data: [] });
  }

  try {
    switch (forRole) {
      case "REGION_ADMIN": {
        const where = assignableRegionsWhere(guard);
        const regions = await prisma.region.findMany({
          where,
          select: { id: true, name: true, unitCode: true },
          orderBy: { name: "asc" },
        });
        return NextResponse.json({ ok: true, data: regions });
      }

      case "SUBREGION_ADMIN": {
        const where = await assignableSubRegionsWhere(guard);
        const subRegions = await prisma.subRegion.findMany({
          where,
          select: { id: true, name: true, unitCode: true, regionId: true },
          orderBy: { name: "asc" },
        });
        return NextResponse.json({ ok: true, data: subRegions });
      }

      case "ZONE_ADMIN": {
        const where = await assignableZonesWhere(guard);
        const zones = await prisma.zone.findMany({
          where,
          select: { id: true, name: true, unitCode: true, cityId: true },
          orderBy: { name: "asc" },
        });
        return NextResponse.json({ ok: true, data: zones });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Use /api/campuses?assignable=true for role "${forRole}"` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Assignable geo fetch error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch assignable units" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/regions
 * Create a geo entity with auto-generated unitCode, scoped to the caller's org.
 * Body: { type: "region"|"subRegion"|"city"|"zone", name, ...optional parent IDs }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const { type, name } = body;

    if (!type || !name) {
      return NextResponse.json(
        { error: "type and name are required" },
        { status: 400 },
      );
    }

    const orgId = resolveOrgId(guard);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { organizationStructure: true },
    });

    try {
      assertCanCreateGeo(org);
    } catch {
      return NextResponse.json(
        { error: "Geo hierarchy is disabled for single-structure organizations", code: "SINGLE_STRUCTURE_GEO_LOCKED" },
        { status: 403 },
      );
    }

    const trimmedName = name.trim();

    switch (type) {
      case "region": {
        const existing = await prisma.region.findFirst({
          where: { name: { equals: trimmedName, mode: "insensitive" }, organizationId: orgId },
        });
        if (existing) {
          return NextResponse.json({ error: `Region "${trimmedName}" already exists` }, { status: 409 });
        }
        const region = await prisma.$transaction(async (tx) => {
          const unitCode = await generateUnitCode("REGION", null, orgId, tx);
          const created = await tx.region.create({ data: { name: trimmedName, unitCode, organizationId: orgId } });
          await createUnitProfile({ tx, organizationId: orgId, unitType: "REGION", unitId: created.id, displayName: trimmedName });
          return created;
        });
        return NextResponse.json(region, { status: 201 });
      }

      case "subRegion": {
        const parentId = body.regionId || null;
        if (parentId) {
          const parentRegion = await prisma.region.findFirst({
            where: { id: parentId, organizationId: orgId },
          });
          if (!parentRegion) {
            return NextResponse.json({ error: "Region not found or not owned by your organization" }, { status: 400 });
          }
        }
        const existing = await prisma.subRegion.findFirst({
          where: { name: { equals: trimmedName, mode: "insensitive" }, regionId: parentId, organizationId: orgId },
        });
        if (existing) {
          return NextResponse.json({ error: `Sub-region "${trimmedName}" already exists under this region` }, { status: 409 });
        }
        const subRegion = await prisma.$transaction(async (tx) => {
          const unitCode = await generateUnitCode("SUBREGION", parentId, orgId, tx);
          const created = await tx.subRegion.create({
            data: { name: trimmedName, unitCode, regionId: parentId, organizationId: orgId },
          });
          await createUnitProfile({ tx, organizationId: orgId, unitType: "SUBREGION", unitId: created.id, displayName: trimmedName });
          return created;
        });
        return NextResponse.json(subRegion, { status: 201 });
      }

      case "city": {
        const existing = await prisma.city.findFirst({
          where: { name: { equals: trimmedName, mode: "insensitive" }, organizationId: orgId },
        });
        if (existing) {
          return NextResponse.json({ error: `City "${trimmedName}" already exists` }, { status: 409 });
        }
        if (body.regionId) {
          const reg = await prisma.region.findFirst({ where: { id: body.regionId, organizationId: orgId } });
          if (!reg) {
            return NextResponse.json({ error: "Region not found or not owned by your organization" }, { status: 400 });
          }
        }
        if (body.subRegionId) {
          const sr = await prisma.subRegion.findFirst({ where: { id: body.subRegionId, organizationId: orgId } });
          if (!sr) {
            return NextResponse.json({ error: "Sub-region not found or not owned by your organization" }, { status: 400 });
          }
        }
        const city = await prisma.$transaction(async (tx) => {
          const unitCode = await generateCityCode(trimmedName, orgId, tx);
          const created = await tx.city.create({
            data: {
              name: trimmedName,
              unitCode,
              organizationId: orgId,
              regionId: body.regionId || null,
              subRegionId: body.subRegionId || null,
            },
          });
          await createUnitProfile({ tx, organizationId: orgId, unitType: "CITY", unitId: created.id, displayName: trimmedName });
          return created;
        });
        return NextResponse.json(city, { status: 201 });
      }

      case "zone": {
        if (!body.cityId) {
          return NextResponse.json(
            { error: "cityId is required for zones" },
            { status: 400 },
          );
        }
        const parentCity = await prisma.city.findFirst({
          where: { id: body.cityId, organizationId: orgId },
        });
        if (!parentCity) {
          return NextResponse.json({ error: "City not found or not owned by your organization" }, { status: 400 });
        }
        const existing = await prisma.zone.findFirst({
          where: { name: { equals: trimmedName, mode: "insensitive" }, cityId: body.cityId, organizationId: orgId },
        });
        if (existing) {
          return NextResponse.json({ error: `Zone "${trimmedName}" already exists in this city` }, { status: 409 });
        }
        const zone = await prisma.$transaction(async (tx) => {
          const unitCode = await generateUnitCode("ZONE", body.cityId, orgId, tx);
          const created = await tx.zone.create({
            data: { name: trimmedName, unitCode, cityId: body.cityId, organizationId: orgId },
          });
          await createUnitProfile({ tx, organizationId: orgId, unitType: "ZONE", unitId: created.id, displayName: trimmedName });
          return created;
        });
        return NextResponse.json(zone, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: "Invalid type. Must be: region, subRegion, city, or zone" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Geo entity creation error:", error);
    return NextResponse.json(
      { error: "Failed to create geo entity" },
      { status: 500 },
    );
  }
}
