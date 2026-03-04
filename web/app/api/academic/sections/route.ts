import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  createSection,
  checkSectionCapacity,
  ClassSectionError,
} from "@/lib/academic/class-section.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/sections?sectionId=...
 *
 * Returns capacity info for a section.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
      return NextResponse.json(
        { ok: false, error: "sectionId query parameter is required" },
        { status: 400 },
      );
    }

    const data = await checkSectionCapacity(sectionId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ClassSectionError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to check capacity";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/sections
 *
 * Body: { academicYearId, campusId, classId, name, capacity?, classTeacherId? }
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

    const academicYearId = body.academicYearId as string;
    const campusId = body.campusId as number;
    const classId = body.classId as string;
    const name = body.name as string;

    if (!academicYearId || !campusId || !classId || !name) {
      return NextResponse.json(
        { ok: false, error: "academicYearId, campusId, classId, and name are required" },
        { status: 400 },
      );
    }

    const section = await createSection({
      organizationId: orgId,
      academicYearId,
      campusId,
      classId,
      name,
      capacity: body.capacity as number | undefined,
      classTeacherId: body.classTeacherId as number | undefined,
    });

    return NextResponse.json({ ok: true, data: section }, { status: 201 });
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
        { ok: false, error: "A section with this name already exists for this class" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Section creation error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
