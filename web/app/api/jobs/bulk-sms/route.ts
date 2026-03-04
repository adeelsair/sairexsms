import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, BULK_SMS_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  message: z.string().min(1, "Message is required").max(640, "Message too long (max 640 chars)"),
  recipients: z
    .array(
      z.object({
        name: z.string().optional(),
        phone: z.string().min(7, "Phone must be at least 7 digits"),
      }),
    )
    .min(1, "At least one recipient is required")
    .max(5000, "Maximum 5000 recipients per batch"),
});

/**
 * POST /api/jobs/bulk-sms
 * Enqueues a bulk SMS job. The worker fans out to individual SMS jobs.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const jobId = await enqueue({
      type: "BULK_SMS",
      queue: BULK_SMS_QUEUE,
      userId: guard.id,
      organizationId: resolveOrgId(guard),
      payload: {
        message: parsed.data.message,
        recipients: parsed.data.recipients,
      },
    });

    return NextResponse.json(
      { jobId, message: `Bulk SMS queued for ${parsed.data.recipients.length} recipients` },
      { status: 202 },
    );
  } catch (error) {
    console.error("Bulk SMS job error:", error);
    return NextResponse.json({ error: "Failed to queue bulk SMS" }, { status: 500 });
  }
}
