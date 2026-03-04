import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  listClasses,
  createClass,
  copyClassStructure,
  ClassSectionError,
} from "@/lib/academic/class-section.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/classes?academicYearId=...&campusId=...
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");

    if (!academicYearId) {
      return NextResponse.json(
        { ok: false, error: "academicYearId query parameter is required" },
        { status: 400 },
      );
    }

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const campusIdParam = searchParams.get("campusId");

    const data = await listClasses(
      {
        organizationId: orgId,
        campusId: campusIdParam ? Number(campusIdParam) : guard.campusId ?? undefined,
        unitPath: guard.unitPath,
      },
      academicYearId,
    );

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch classes";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/classes
 *
 * Create a class:
 *   { academicYearId, campusId, name, code?, displayOrder? }
 *
 * Copy class structure from another year:
 *   { action: "copy", sourceYearId, targetYearId }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    if (body.action === "copy") {
      const sourceYearId = body.sourceYearId as string;
      const targetYearId = body.targetYearId as string;

      if (!sourceYearId || !targetYearId) {
        return NextResponse.json(
          { ok: false, error: "sourceYearId and targetYearId are required" },
          { status: 400 },
        );
      }

      const result = await copyClassStructure(sourceYearId, targetYearId, orgId);
      return NextResponse.json({ ok: true, data: result });
    }

    const academicYearId = body.academicYearId as string;
    const campusId = body.campusId as number;
    const name = body.name as string;

    if (!academicYearId || !campusId || !name) {
      return NextResponse.json(
        { ok: false, error: "academicYearId, campusId, and name are required" },
        { status: 400 },
      );
    }

    const cls = await createClass({
      organizationId: orgId,
      academicYearId,
      campusId,
      name,
      code: body.code as string | undefined,
      displayOrder: body.displayOrder as number | undefined,
    });

    return NextResponse.json({ ok: true, data: cls }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ClassSectionError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "A class with this name already exists for this campus and academic year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Class creation error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
