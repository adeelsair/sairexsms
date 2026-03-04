import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { enqueue, IMPORT_QUEUE } from "@/lib/queue";
import { resolveOrgId } from "@/lib/tenant";

const schema = z.object({
  importType: z.enum(["STUDENTS"]),
  campusId: z.number().int().positive("Campus is required"),
  csvBase64: z.string().min(1, "CSV data is required"),
});

/**
 * POST /api/jobs/import
 * Accepts base64-encoded CSV data and enqueues an import job.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
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

    const csvData = Buffer.from(parsed.data.csvBase64, "base64").toString("utf-8");

    const lineCount = csvData.trim().split(/\r?\n/).length - 1;
    if (lineCount > 10000) {
      return NextResponse.json(
        { error: "CSV too large. Maximum 10,000 rows per import." },
        { status: 400 },
      );
    }

    const jobId = await enqueue({
      type: "IMPORT",
      queue: IMPORT_QUEUE,
      userId: guard.id,
      organizationId: resolveOrgId(guard),
      payload: {
        importType: parsed.data.importType,
        organizationId: resolveOrgId(guard),
        campusId: parsed.data.campusId,
        csvData,
        importedBy: guard.email,
      },
    });

    return NextResponse.json(
      { jobId, message: `Import queued: ~${lineCount} rows` },
      { status: 202 },
    );
  } catch (error) {
    console.error("Import job error:", error);
    return NextResponse.json({ error: "Failed to queue import" }, { status: 500 });
  }
}
