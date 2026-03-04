import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  getEnrollment,
  transferSection,
  transferCampus,
  withdrawStudent,
  promoteStudent,
  EnrollmentError,
} from "@/lib/academic/enrollment.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/academic/enrollments/:id
 *
 * Returns enrollment detail with promotion chain.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await context.params;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await getEnrollment(id, orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof EnrollmentError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch enrollment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/academic/enrollments/:id
 *
 * Actions:
 *   { action: "transferSection", sectionId, classId? }
 *   { action: "transferCampus", campusId, classId, sectionId? }
 *   { action: "withdraw" }
 *   { action: "promote", targetYearId, campusId, classId, sectionId?, rollNumber? }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const action = body.action as string;
    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action is required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "transferSection": {
        const sectionId = body.sectionId as string;
        if (!sectionId) {
          return NextResponse.json(
            { ok: false, error: "sectionId is required for section transfer" },
            { status: 400 },
          );
        }

        const data = await transferSection({
          enrollmentId: id,
          organizationId: orgId,
          classId: body.classId as string | undefined,
          sectionId,
        });

        return NextResponse.json({ ok: true, data });
      }

      case "transferCampus": {
        const campusId = body.campusId as number;
        const classId = body.classId as string;
        if (!campusId || !classId) {
          return NextResponse.json(
            { ok: false, error: "campusId and classId are required for campus transfer" },
            { status: 400 },
          );
        }

        const data = await transferCampus({
          enrollmentId: id,
          organizationId: orgId,
          campusId,
          classId,
          sectionId: body.sectionId as string | undefined,
        });

        return NextResponse.json({ ok: true, data });
      }

      case "withdraw": {
        const data = await withdrawStudent(id, orgId);
        return NextResponse.json({ ok: true, data });
      }

      case "promote": {
        const adminCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
        if (adminCheck) return adminCheck;

        const targetYearId = body.targetYearId as string;
        const campusId = body.campusId as number;
        const classId = body.classId as string;

        if (!targetYearId || !campusId || !classId) {
          return NextResponse.json(
            { ok: false, error: "targetYearId, campusId, and classId are required for promotion" },
            { status: 400 },
          );
        }

        const data = await promoteStudent({
          enrollmentId: id,
          organizationId: orgId,
          targetYearId,
          campusId,
          classId,
          sectionId: body.sectionId as string | undefined,
          rollNumber: body.rollNumber as string | undefined,
        });

        return NextResponse.json({ ok: true, data });
      }

      default:
        return NextResponse.json(
          { ok: false, error: "Invalid action. Must be: transferSection, transferCampus, withdraw, or promote" },
          { status: 400 },
        );
    }
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
        { ok: false, error: "Student is already enrolled in the target academic year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Enrollment action error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
