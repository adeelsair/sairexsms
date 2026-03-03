import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { enqueue, REMINDER_QUEUE } from "@/lib/queue";

/**
 * GET /api/cron/reminders
 *
 * Manual fallback trigger for reminder runs.
 * Primary daily execution is handled by the scheduler worker.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const jobId = await enqueue({
      type: "REMINDER_RUN",
      queue: REMINDER_QUEUE,
      organizationId: orgId,
      userId: guard.id,
      payload: { organizationId: orgId },
      maxAttempts: 5,
      idempotencyKey: `cron-reminder-run:${orgId}:${dateKey}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        enqueued: true,
      },
    });
  } catch (error) {
    console.error("Cron reminder error:", error);
    return NextResponse.json(
      { error: "Failed to enqueue reminders" },
      { status: 500 }
    );
  }
}
