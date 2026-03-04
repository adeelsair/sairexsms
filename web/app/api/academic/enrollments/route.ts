import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import {
  enrollStudent,
  listEnrollments,
  getEnrollmentStats,
  listUnenrolledStudents,
  listEnrollmentsBySection,
  bulkEnrollStudents,
  bulkPromote,
  EnrollmentError,
} from "@/lib/academic/enrollment.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/enrollments
 *
 * Query params:
 *   academicYearId - defaults to active year
 *   classId, sectionId, status, search
 *   limit, offset
 *   view=stats - returns enrollment stats instead of list
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const campusIdParam = searchParams.get("campusId");
    const scope = {
      organizationId: orgId,
      campusId: campusIdParam ? Number(campusIdParam) : guard.campusId ?? undefined,
      unitPath: guard.unitPath,
    };

    const view = searchParams.get("view");
    const academicYearId = searchParams.get("academicYearId") ?? undefined;

    if (view === "stats") {
      if (!academicYearId) {
        return NextResponse.json(
          { ok: false, error: "academicYearId is required for stats view" },
          { status: 400 },
        );
      }
      const data = await getEnrollmentStats(scope, academicYearId);
      return NextResponse.json({ ok: true, data });
    }

    if (view === "unenrolled") {
      if (!academicYearId) {
        return NextResponse.json(
          { ok: false, error: "academicYearId is required for unenrolled view" },
          { status: 400 },
        );
      }

      const campusId = campusIdParam ? Number(campusIdParam) : guard.campusId;
      if (!campusId) {
        return NextResponse.json(
          { ok: false, error: "campusId is required for unenrolled view" },
          { status: 400 },
        );
      }

      const data = await listUnenrolledStudents({
        scope,
        academicYearId,
        campusId,
        search: searchParams.get("search") ?? undefined,
        limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
        offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
      });

      return NextResponse.json({ ok: true, data });
    }

    if (view === "section") {
      const sectionId = searchParams.get("sectionId");
      if (!sectionId) {
        return NextResponse.json(
          { ok: false, error: "sectionId is required for section view" },
          { status: 400 },
        );
      }
      if (!academicYearId) {
        return NextResponse.json(
          { ok: false, error: "academicYearId is required for section view" },
          { status: 400 },
        );
      }

      const data = await listEnrollmentsBySection({
        scope,
        academicYearId,
        sectionId,
        search: searchParams.get("search") ?? undefined,
        limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
        offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
      });

      return NextResponse.json({ ok: true, data });
    }

    const data = await listEnrollments({
      scope,
      academicYearId,
      classId: searchParams.get("classId") ?? undefined,
      sectionId: searchParams.get("sectionId") ?? undefined,
      status: (searchParams.get("status") as import("@/lib/generated/prisma").EnrollmentStatus) ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch enrollments";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/enrollments
 *
 * Enroll a student:
 *   { studentId, campusId, classId, sectionId?, rollNumber?, admissionDate? }
 *
 * Bulk promote:
 *   { action: "bulkPromote", sourceYearId, targetYearId, mappings: [...] }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const auditActor = resolveAuditActor(guard);
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    if (body.action === "bulkPromote") {
      const adminCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
      if (adminCheck) return adminCheck;

      const sourceYearId = body.sourceYearId as string;
      const targetYearId = body.targetYearId as string;
      const mappings = body.mappings as BulkPromoteMapping[];

      if (!sourceYearId || !targetYearId || !Array.isArray(mappings) || mappings.length === 0) {
        return NextResponse.json(
          { ok: false, error: "sourceYearId, targetYearId, and non-empty mappings array are required" },
          { status: 400 },
        );
      }

      const result = await bulkPromote({
        organizationId: orgId,
        sourceYearId,
        targetYearId,
        mappings,
      });

      return NextResponse.json({ ok: true, data: result });
    }

    if (body.action === "bulkEnroll") {
      const sectionId = body.sectionId as string;
      const studentIds = body.studentIds as number[] | undefined;

      if (!sectionId || !Array.isArray(studentIds)) {
        return NextResponse.json(
          { ok: false, error: "sectionId and studentIds[] are required" },
          { status: 400 },
        );
      }

      const result = await bulkEnrollStudents({
        organizationId: orgId,
        sectionId,
        studentIds,
      });

      return NextResponse.json({ ok: true, data: result });
    }

    const studentId = body.studentId as number;
    const campusId = body.campusId as number;
    const classId = body.classId as string;

    if (!studentId || !campusId || !classId) {
      return NextResponse.json(
        { ok: false, error: "studentId, campusId, and classId are required" },
        { status: 400 },
      );
    }

    const enrollment = await enrollStudent({
      organizationId: orgId,
      studentId,
      campusId,
      classId,
      sectionId: body.sectionId as string | undefined,
      rollNumber: body.rollNumber as string | undefined,
      admissionDate: body.admissionDate ? new Date(body.admissionDate as string) : undefined,
      auditActor,
    });

    return NextResponse.json({ ok: true, data: enrollment }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof EnrollmentError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "Student is already enrolled in this academic year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Enrollment error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

interface BulkPromoteMapping {
  enrollmentId: string;
  campusId: number;
  classId: string;
  sectionId?: string;
  rollNumber?: string;
  status: "PROMOTED" | "RETAINED" | "GRADUATED";
}
