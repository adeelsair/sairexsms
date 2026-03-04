import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { getQueue } from "@/lib/queue";

/**
 * GET /api/jobs/:id
 * Returns the current status of a background job.
 * Clients can poll this endpoint to check if a PDF/report is ready.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      queue: true,
      status: true,
      priority: true,
      progress: true,
      attempts: true,
      maxAttempts: true,
      error: true,
      result: true,
      referenceId: true,
      referenceType: true,
      idempotencyKey: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      failedAt: true,
      user: { select: { email: true } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

/**
 * POST /api/jobs/:id
 * Actions: { action: "retry" } — re-enqueue a FAILED or DEAD job.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json();

  if (body.action !== "retry") {
    return NextResponse.json({ error: 'Only action "retry" is supported' }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!["FAILED", "DEAD"].includes(job.status)) {
    return NextResponse.json(
      { error: `Cannot retry job with status ${job.status}` },
      { status: 400 },
    );
  }

  await prisma.job.update({
    where: { id },
    data: {
      status: "PENDING",
      error: null,
      failedAt: null,
      progress: null,
      attempts: 0,
    },
  });

  try {
    const queue = getQueue(job.queue);
    await queue.add(
      job.type,
      { jobId: job.id, ...(job.payload as Record<string, unknown>) },
      { jobId: job.id, priority: job.priority },
    );
  } catch (err) {
    console.error(`[Job Retry] Failed to re-enqueue job ${id}:`, err);
  }

  return NextResponse.json({ retried: true, jobId: id });
}
