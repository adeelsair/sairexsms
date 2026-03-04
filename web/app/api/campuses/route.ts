import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { scopeFilter, resolveOrgId } from "@/lib/tenant";
import { assertCanCreateCampus } from "@/lib/org-structure";
import { generateUnitCode, buildFullUnitPath } from "@/lib/unit-code";
import { createUnitProfile } from "@/lib/unit-profile";
import { assignableCampusesWhere } from "@/lib/rbac/assignable-scope";

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const assignable = searchParams.get("assignable");

    if (assignable === "true") {
      const where = assignableCampusesWhere(guard);
      const campuses = await prisma.campus.findMany({
        where,
        select: {
          id: true,
          name: true,
          fullUnitPath: true,
          campusCode: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ ok: true, data: campuses });
    }

    const where = scopeFilter(guard);

    const campuses = await prisma.campus.findMany({
      where,
      include: {
        organization: { select: { id: true, organizationName: true } },
        city: {
          select: {
            id: true,
            name: true,
            unitCode: true,
            region: { select: { id: true, name: true, unitCode: true } },
          },
        },
        zone: { select: { id: true, name: true, unitCode: true } },
      },
    });
    return NextResponse.json(campuses);
  } catch (error) {
    console.error("Campus fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campuses" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json();
    const orgId = resolveOrgId(guard);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { organizationStructure: true },
    });

    try {
      assertCanCreateCampus(org);
    } catch {
      return NextResponse.json(
        { error: "Single-structure organization can only have one campus" },
        { status: 403 },
      );
    }

    if (org.organizationStructure === "SINGLE") {
      const campusCount = await prisma.campus.count({
        where: { organizationId: orgId },
      });
      if (campusCount >= 1) {
        return NextResponse.json(
          { error: "Single-structure organization can only have one campus" },
          { status: 403 },
        );
      }
    }

    if (!body.cityId) {
      return NextResponse.json(
        { error: "City is required" },
        { status: 400 },
      );
    }

    const city = await prisma.city.findFirst({ where: { id: body.cityId, organizationId: orgId } });
    if (!city) {
      return NextResponse.json(
        { error: "City not found or not owned by your organization" },
        { status: 404 },
      );
    }

    if (body.zoneId) {
      const zone = await prisma.zone.findFirst({ where: { id: body.zoneId, organizationId: orgId } });
      if (!zone || zone.cityId !== body.cityId) {
        return NextResponse.json(
          { error: "Zone not found or does not belong to selected city" },
          { status: 400 },
        );
      }
    }

    const campus = await prisma.$transaction(async (tx) => {
      const scopeId = body.zoneId || body.cityId;
      const unitCode = await generateUnitCode("CAMPUS", scopeId, orgId, tx);
      const fullUnitPath = await buildFullUnitPath(
        body.cityId,
        body.zoneId || null,
        unitCode,
        tx,
      );

      const campusCode = `${orgId}-${fullUnitPath}`;
      const campusSlug = campusCode.toLowerCase();

      const created = await tx.campus.create({
        data: {
          name: body.name,
          campusCode,
          campusSlug,
          unitCode,
          fullUnitPath,
          organizationId: orgId,
          cityId: body.cityId,
          zoneId: body.zoneId || null,
        },
      });
      await createUnitProfile({ tx, organizationId: orgId, unitType: "CAMPUS", unitId: String(created.id), displayName: body.name });
      return created;
    });

    return NextResponse.json(campus, { status: 201 });
  } catch (error) {
    console.error("Campus creation error:", error);
    return NextResponse.json(
      { error: "Failed to create campus" },
      { status: 500 },
    );
  }
}
