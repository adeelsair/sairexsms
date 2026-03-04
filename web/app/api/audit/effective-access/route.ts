import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { computeEffectiveCampusAccess } from "@/lib/rbac/effective-access";

const STAFF_ROLES = ["TEACHER", "ACCOUNTANT", "STAFF"] as const;

/**
 * GET /api/audit/effective-access?userId=123&countOnly=true&includeStats=true
 *
 * Computes the effective campus list (or count) for a target user's
 * current membership. Scoped — callers only see users within their
 * own hierarchy.
 *
 * When includeStats=true, also returns students, staff, and revenue totals.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const countOnly = searchParams.get("countOnly") === "true";
    const includeStats = searchParams.get("includeStats") === "true";

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "userId is required" },
        { status: 400 },
      );
    }

    const targetUserId = parseInt(userId, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid userId" },
        { status: 400 },
      );
    }

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: targetUserId,
        organizationId: orgId,
      },
      select: {
        role: true,
        unitPath: true,
        campusId: true,
        status: true,
      },
    });

    if (!membership) {
      return NextResponse.json({
        ok: true,
        data: { campuses: [], totalCampuses: 0, role: null, unitPath: null },
      });
    }

    if (
      !isSuperAdmin(guard) &&
      guard.role !== "ORG_ADMIN" &&
      guard.unitPath &&
      membership.unitPath &&
      !membership.unitPath.startsWith(guard.unitPath)
    ) {
      return NextResponse.json(
        { ok: false, error: "User is outside your scope" },
        { status: 403 },
      );
    }

    if (membership.status !== "ACTIVE") {
      return NextResponse.json({
        ok: true,
        data: {
          campuses: [],
          totalCampuses: 0,
          role: membership.role,
          unitPath: membership.unitPath,
          status: membership.status,
        },
      });
    }

    const access = await computeEffectiveCampusAccess({
      organizationId: orgId,
      role: membership.role,
      unitPath: membership.unitPath,
      campusId: membership.campusId,
      countOnly: countOnly && !includeStats,
    });

    let stats: { students: number; staff: number; revenue: number } | undefined;

    if (includeStats && access.totalCampuses > 0) {
      const campusIds =
        access.campuses.length > 0
          ? access.campuses.map((c) => c.id)
          : (
              await prisma.campus.findMany({
                where: {
                  organizationId: orgId,
                  status: "ACTIVE",
                  ...(membership.unitPath
                    ? { fullUnitPath: { startsWith: membership.unitPath } }
                    : {}),
                },
                select: { id: true },
              })
            ).map((c) => c.id);

      const [studentCount, staffCount, revenueAgg] =
        await prisma.$transaction([
          prisma.student.count({
            where: { campusId: { in: campusIds } },
          }),
          prisma.membership.count({
            where: {
              organizationId: orgId,
              status: "ACTIVE",
              role: { in: [...STAFF_ROLES] },
              campusId: { in: campusIds },
            },
          }),
          prisma.feeChallan.aggregate({
            _sum: { paidAmount: true },
            where: { campusId: { in: campusIds } },
          }),
        ]);

      stats = {
        students: studentCount,
        staff: staffCount,
        revenue: Number(revenueAgg._sum.paidAmount ?? 0),
      };
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...access,
        role: membership.role,
        unitPath: membership.unitPath,
        status: membership.status,
        ...(stats ? { stats } : {}),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to compute effective access";
    console.error("Effective access error:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
