import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  getReminderStats,
} from "@/lib/finance/reminder-engine.service";
import { enqueue, REMINDER_QUEUE } from "@/lib/queue";

/**
 * POST /api/finance/reminders
 *
 * Trigger a reminder run job for the authenticated user's scope.
 * Restricted to ORG_ADMIN+ roles.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "REGION_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = await request.json().catch(() => ({}));
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const payload: {
      organizationId: string;
      unitPath?: string;
      campusId?: number;
    } = { organizationId: orgId };

    if (!isSuperAdmin(guard) && guard.role !== "ORG_ADMIN" && guard.unitPath) {
      payload.unitPath = guard.unitPath;
    }

    const campusId = (body as Record<string, unknown>).campusId;
    if (typeof campusId === "number") {
      payload.campusId = campusId;
    } else if (guard.campusId && guard.role === "CAMPUS_ADMIN") {
      payload.campusId = guard.campusId;
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const idempotencySuffix = payload.campusId
      ? `campus-${payload.campusId}`
      : payload.unitPath
        ? `unit-${payload.unitPath}`
        : "org";
    const jobId = await enqueue({
      type: "REMINDER_RUN",
      queue: REMINDER_QUEUE,
      organizationId: orgId,
      userId: guard.id,
      payload: {
        organizationId: orgId,
        ...(payload.unitPath ? { unitPath: payload.unitPath } : {}),
        ...(payload.campusId ? { campusId: payload.campusId } : {}),
      },
      maxAttempts: 5,
      idempotencyKey: `manual-reminder-run:${orgId}:${idempotencySuffix}:${dateKey}`,
    });

    return NextResponse.json({ ok: true, data: { jobId, enqueued: true } }, { status: 202 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enqueue reminder run";
    console.error("Reminder engine error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/finance/reminders?daysBack=30
 *
 * Returns reminder delivery stats by channel.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const daysBack = parseInt(searchParams.get("daysBack") ?? "30", 10) || 30;
    const stats = await getReminderStats(orgId, daysBack);

    return NextResponse.json({ ok: true, data: stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch reminder stats";
    console.error("Reminder stats error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
