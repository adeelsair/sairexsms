import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  listSubjects,
  createSubject,
  bulkCreateSubjects,
  ExamError,
} from "@/lib/academic/exam.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/subjects?academicYearId=...&classId=...
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");

    if (!academicYearId) {
      return NextResponse.json(
        { ok: false, error: "academicYearId is required" },
        { status: 400 },
      );
    }

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const data = await listSubjects(
      {
        organizationId: orgId,
        campusId: searchParams.get("campusId") ? Number(searchParams.get("campusId")) : guard.campusId ?? undefined,
        unitPath: guard.unitPath,
      },
      academicYearId,
      searchParams.get("classId") ?? undefined,
    );

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch subjects";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/subjects
 *
 * Single: { academicYearId, campusId, classId, name, code? }
 * Bulk:   { action: "bulk", academicYearId, campusId, classId, names: string[] }
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
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const academicYearId = body.academicYearId as string;
    const campusId = body.campusId as number;
    const classId = body.classId as string;

    if (!academicYearId || !campusId || !classId) {
      return NextResponse.json(
        { ok: false, error: "academicYearId, campusId, and classId are required" },
        { status: 400 },
      );
    }

    if (body.action === "bulk") {
      const names = body.names as string[];
      if (!Array.isArray(names) || names.length === 0) {
        return NextResponse.json(
          { ok: false, error: "names array is required for bulk creation" },
          { status: 400 },
        );
      }

      const data = await bulkCreateSubjects(orgId, academicYearId, campusId, classId, names);
      return NextResponse.json({ ok: true, data }, { status: 201 });
    }

    const name = body.name as string;
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    const data = await createSubject({
      organizationId: orgId,
      academicYearId,
      campusId,
      classId,
      name,
      code: body.code as string | undefined,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ExamError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" && error !== null && "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "A subject with this name already exists for this class and year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Subject creation error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
