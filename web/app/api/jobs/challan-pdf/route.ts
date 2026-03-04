import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, CHALLAN_PDF_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  challanId: z.number().int().positive(),
});

/**
 * POST /api/jobs/challan-pdf
 * Enqueues a challan PDF generation job. Returns the job ID immediately.
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
        { error: "Valid challanId is required", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const jobId = await enqueue({
      type: "CHALLAN_PDF",
      queue: CHALLAN_PDF_QUEUE,
      userId: guard.id,
      organizationId: resolveOrgId(guard),
      payload: { challanId: parsed.data.challanId },
    });

    return NextResponse.json({ jobId, message: "PDF generation queued" }, { status: 202 });
  } catch (error) {
    console.error("Challan PDF job error:", error);
    return NextResponse.json({ error: "Failed to queue PDF generation" }, { status: 500 });
  }
}
