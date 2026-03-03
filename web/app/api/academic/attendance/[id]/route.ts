import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@/lib/generated/prisma";
import { updateAttendance, AttendanceError } from "@/lib/academic/attendance.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/academic/attendance/:id
 *
 * Body: { status, remarks? }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(
    guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "TEACHER",
  );
  if (roleCheck) return roleCheck;

  try {
    const audit = resolveAuditActor(guard);
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const status = body.status as AttendanceStatus;
    if (!status) {
      return NextResponse.json(
        { ok: false, error: "status is required" },
        { status: 400 },
      );
    }

    const data = await updateAttendance({
      attendanceId: id,
      organizationId: orgId,
      status,
      remarks: body.remarks as string | undefined,
    });

    await prisma.domainEventLog.create({
      data: {
        organizationId: audit.tenantId,
        eventType: "ATTENDANCE_UPDATED",
        payload: {
          attendanceId: id,
          status,
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

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof AttendanceError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Update failed";
    console.error("Attendance update error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
