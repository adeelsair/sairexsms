import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, REPORT_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  reportType: z.enum(["FEE_COLLECTION", "FEE_DEFAULTERS", "STUDENT_LIST"]),
  campusId: z.number().int().positive().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/jobs/report
 * Enqueues a report generation job. Returns the job ID immediately.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "ACCOUNTANT");
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid report parameters", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const orgId = resolveOrgId(guard);

    const jobId = await enqueue({
      type: "REPORT",
      queue: REPORT_QUEUE,
      userId: guard.id,
      organizationId: orgId,
      payload: {
        reportType: parsed.data.reportType,
        organizationId: orgId,
        campusId: parsed.data.campusId,
        filters: parsed.data.filters,
        generatedBy: guard.email,
      },
    });

    return NextResponse.json({ jobId, message: "Report generation queued" }, { status: 202 });
  } catch (error) {
    console.error("Report job error:", error);
    return NextResponse.json({ error: "Failed to queue report generation" }, { status: 500 });
  }
}
