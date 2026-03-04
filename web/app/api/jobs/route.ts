import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { enqueue, FINANCE_QUEUE, PROMOTION_QUEUE, REMINDER_QUEUE } from "@/lib/queue";

/**
 * GET /api/jobs?status=...&type=...&queue=...&page=1&limit=50
 * Returns paginated job list for the admin dashboard.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const type = url.searchParams.get("type") || undefined;
    const queue = url.searchParams.get("queue") || undefined;
    const referenceId = url.searchParams.get("referenceId") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (!isSuperAdmin(guard) && guard.organizationId) {
      where.organizationId = guard.organizationId;
    }

    if (status) where.status = status;
    if (type) where.type = type;
    if (queue) where.queue = queue;
    if (referenceId) where.referenceId = referenceId;

    const [jobs, total, stats] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
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
      }),
      prisma.job.count({ where }),
      prisma.job.groupBy({
        by: ["status"],
        where: isSuperAdmin(guard) ? {} : { organizationId: guard.organizationId ?? undefined },
        _count: true,
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of stats) {
      statusCounts[s.status] = s._count;
    }

    return NextResponse.json({
      jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statusCounts,
    });
  } catch (error) {
    console.error("Job list error:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

const ALLOWED_DISPATCH_TYPES = [
  "MONTHLY_POSTING",
  "RECONCILE_PAYMENT",
  "PROMOTION_RUN",
  "ROLLOVER_STRUCTURE",
  "REMINDER_RUN",
] as const;

type DispatchType = (typeof ALLOWED_DISPATCH_TYPES)[number];

const TYPE_TO_QUEUE: Record<DispatchType, string> = {
  MONTHLY_POSTING: FINANCE_QUEUE,
  RECONCILE_PAYMENT: FINANCE_QUEUE,
  PROMOTION_RUN: PROMOTION_QUEUE,
  ROLLOVER_STRUCTURE: PROMOTION_QUEUE,
  REMINDER_RUN: REMINDER_QUEUE,
};

const TYPE_MAX_ATTEMPTS: Record<DispatchType, number> = {
  MONTHLY_POSTING: 2,
  RECONCILE_PAYMENT: 3,
  PROMOTION_RUN: 1,
  ROLLOVER_STRUCTURE: 1,
  REMINDER_RUN: 5,
};

/**
 * POST /api/jobs
 * Dispatch a domain job via the queue system.
 *
 * Body: { type, payload, idempotencyKey?, referenceId?, referenceType?, priority? }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { type, payload, idempotencyKey, referenceId, referenceType, priority } = body;

    if (!type || !payload) {
      return NextResponse.json({ error: "type and payload are required" }, { status: 400 });
    }

    if (!ALLOWED_DISPATCH_TYPES.includes(type as DispatchType)) {
      return NextResponse.json(
        { error: `Invalid job type. Allowed: ${ALLOWED_DISPATCH_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const dispatchType = type as DispatchType;
    const orgId = guard.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const jobId = await enqueue({
      type: dispatchType,
      queue: TYPE_TO_QUEUE[dispatchType],
      payload: { ...payload, organizationId: orgId, userId: guard.id },
      organizationId: orgId,
      userId: guard.id,
      priority: priority ?? 0,
      maxAttempts: TYPE_MAX_ATTEMPTS[dispatchType],
      idempotencyKey: idempotencyKey ?? undefined,
      referenceId: referenceId ?? undefined,
      referenceType: referenceType ?? undefined,
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    console.error("Job dispatch error:", error);
    return NextResponse.json({ error: "Failed to dispatch job" }, { status: 500 });
  }
}
