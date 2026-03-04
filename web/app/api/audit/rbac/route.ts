import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import type { Prisma } from "@/lib/generated/prisma";

const MAX_PAGE_SIZE = 100;

/**
 * GET /api/audit/rbac
 *
 * Paginated, filterable RBAC audit feed.
 * Hierarchically scoped — users only see logs within their unitPath.
 *
 * Query params:
 *   page, pageSize, action, actorUserId, targetUserId,
 *   from (or dateFrom), to (or dateTo), search
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("pageSize") ?? 20)),
    );
    const action = searchParams.get("action");
    const actorUserId = searchParams.get("actorUserId");
    const targetUserId = searchParams.get("targetUserId");
    const dateFrom = searchParams.get("from") ?? searchParams.get("dateFrom");
    const dateTo = searchParams.get("to") ?? searchParams.get("dateTo");
    const search = searchParams.get("search");

    const skip = (page - 1) * pageSize;

    const andClauses: Prisma.RbacAuditLogWhereInput[] = [];

    const where: Prisma.RbacAuditLogWhereInput = {};

    where.organizationId = guard.organizationId!;

    if (
      guard.organizationStructure !== "SINGLE" &&
      guard.role !== "ORG_ADMIN" &&
      guard.unitPath
    ) {
      andClauses.push({
        OR: [
          { newUnitPath: { startsWith: guard.unitPath } },
          { oldUnitPath: { startsWith: guard.unitPath } },
        ],
      });
    }

    if (action) {
      where.action = action as Prisma.EnumAuditActionFilter;
    }

    if (actorUserId) {
      const aid = parseInt(actorUserId, 10);
      if (!isNaN(aid)) where.actorUserId = aid;
    }

    if (targetUserId) {
      const tid = parseInt(targetUserId, 10);
      if (!isNaN(tid)) where.targetUserId = tid;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      andClauses.push({
        OR: [
          { actor: { name: { contains: search, mode: "insensitive" } } },
          { actor: { email: { contains: search, mode: "insensitive" } } },
          { target: { name: { contains: search, mode: "insensitive" } } },
          { target: { email: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const [data, total] = await prisma.$transaction([
      prisma.rbacAuditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true } },
          target: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.rbacAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch audit log";
    console.error("RBAC audit fetch error:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
