import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@/lib/generated/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import {
  bulkMarkAttendance,
  getSectionAttendanceByDate,
  queryAttendance,
  getDaySummary,
  getStudentAttendanceSummary,
  getAttendanceOverview,
  AttendanceError,
} from "@/lib/academic/attendance.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

function isPrismaP2028(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as Prisma.PrismaClientKnownRequestError).code === "P2028",
  );
}

/**
 * GET /api/academic/attendance
 *
 * Query params:
 *   view = "section"   — section attendance for a date (sectionId + date required)
 *   view = "summary"   — day summary counts (sectionId + date required)
 *   view = "student"   — student attendance summary (academicYearId required)
 *   view = "overview"  — campus/class overview for a date (academicYearId + date required)
 *   (default)          — paginated attendance records
 *
 * Common filters: academicYearId, sectionId, classId, studentId,
 *                 date, dateFrom, dateTo, status, limit, offset
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

    if (view === "section") {
      const sectionId = searchParams.get("sectionId");
      const dateStr = searchParams.get("date");
      if (!sectionId || !dateStr) {
        return NextResponse.json(
          { ok: false, error: "sectionId and date are required for section view" },
          { status: 400 },
        );
      }

      const data = await getSectionAttendanceByDate(scope, sectionId, new Date(dateStr));
      return NextResponse.json({ ok: true, data });
    }

    if (view === "summary") {
      const sectionId = searchParams.get("sectionId");
      const dateStr = searchParams.get("date");
      if (!sectionId || !dateStr) {
        return NextResponse.json(
          { ok: false, error: "sectionId and date are required for summary view" },
          { status: 400 },
        );
      }

      const data = await getDaySummary(scope, sectionId, new Date(dateStr));
      return NextResponse.json({ ok: true, data });
    }

    if (view === "student") {
      const academicYearId = searchParams.get("academicYearId");
      if (!academicYearId) {
        return NextResponse.json(
          { ok: false, error: "academicYearId is required for student summary view" },
          { status: 400 },
        );
      }

      const data = await getStudentAttendanceSummary(scope, academicYearId, {
        classId: searchParams.get("classId") ?? undefined,
        sectionId: searchParams.get("sectionId") ?? undefined,
        dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
        dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
      });
      return NextResponse.json({ ok: true, data });
    }

    if (view === "overview") {
      const academicYearId = searchParams.get("academicYearId");
      const dateStr = searchParams.get("date");
      if (!academicYearId || !dateStr) {
        return NextResponse.json(
          { ok: false, error: "academicYearId and date are required for overview" },
          { status: 400 },
        );
      }

      const data = await getAttendanceOverview(scope, academicYearId, new Date(dateStr));
      return NextResponse.json({ ok: true, data });
    }

    const academicYearId = searchParams.get("academicYearId");
    if (!academicYearId) {
      return NextResponse.json(
        { ok: false, error: "academicYearId is required" },
        { status: 400 },
      );
    }

    const data = await queryAttendance({
      scope,
      academicYearId,
      sectionId: searchParams.get("sectionId") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      studentId: searchParams.get("studentId") ? Number(searchParams.get("studentId")) : undefined,
      date: searchParams.get("date") ? new Date(searchParams.get("date")!) : undefined,
      dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
      dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
      status: (searchParams.get("status") as AttendanceStatus) ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof AttendanceError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/attendance
 *
 * Bulk mark attendance for a section on a date.
 *
 * Body:
 * {
 *   academicYearId, campusId, classId, sectionId, date,
 *   entries: [{ enrollmentId, studentId, status, remarks? }, ...]
 * }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(
    guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "TEACHER",
  );
  if (roleCheck) return roleCheck;

  try {
    const audit = resolveAuditActor(guard);
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
    const sectionId = body.sectionId as string;
    const dateStr = body.date as string;
    const entries = body.entries as Array<{
      enrollmentId: string;
      studentId: number;
      status: AttendanceStatus;
      remarks?: string;
    }>;

    if (!academicYearId || !campusId || !classId || !sectionId || !dateStr || !Array.isArray(entries)) {
      return NextResponse.json(
        { ok: false, error: "academicYearId, campusId, classId, sectionId, date, and entries array are required" },
        { status: 400 },
      );
    }

    const MAX_ATTENDANCE_RETRIES = 3;
    let result: Awaited<ReturnType<typeof bulkMarkAttendance>> | null = null;
    for (let attempt = 1; attempt <= MAX_ATTENDANCE_RETRIES; attempt += 1) {
      try {
        result = await bulkMarkAttendance({
          organizationId: orgId,
          academicYearId,
          campusId,
          classId,
          sectionId,
          date: new Date(dateStr),
          markedById: guard.membershipId ?? undefined,
          entries,
        });
        break;
      } catch (error) {
        if (!isPrismaP2028(error) || attempt === MAX_ATTENDANCE_RETRIES) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }

    if (!result) {
      return NextResponse.json(
        { ok: false, error: "Attendance marking failed after retries" },
        { status: 500 },
      );
    }

    await prisma.domainEventLog.create({
      data: {
        organizationId: audit.tenantId,
        eventType: "ATTENDANCE_BULK_MARKED",
        payload: {
          sectionId,
          campusId,
          classId,
          academicYearId,
          entryCount: entries.length,
          _audit: {
            actorUserId: audit.actorUserId,
            effectiveUserId: audit.effectiveUserId,
            tenantId: audit.tenantId,
            impersonation: audit.impersonation,
            impersonatedTenantId: audit.impersonation ? audit.tenantId : null,
          },
        },
        occurredAt: new Date(),
        initiatedByUserId: audit.actorUserId,
        processed: true,
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AttendanceError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Failed to mark attendance";
    console.error("Attendance marking error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
