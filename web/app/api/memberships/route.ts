import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import type { Prisma } from "@/lib/generated/prisma";

const MAX_PAGE_SIZE = 100;

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
    const role = searchParams.get("role");
    const unitId = searchParams.get("unitId");
    const search = searchParams.get("search");

    const skip = (page - 1) * pageSize;

    const where: Prisma.MembershipWhereInput = {};

    where.organizationId = guard.organizationId!;

    if (
      !isSuperAdmin(guard) &&
      guard.organizationStructure !== "SINGLE" &&
      guard.role !== "ORG_ADMIN" &&
      guard.unitPath
    ) {
      where.unitPath = { startsWith: guard.unitPath };
    }

    if (role) {
      where.role = role as Prisma.EnumMembershipRoleFilter;
    }

    if (unitId) {
      const campusId = parseInt(unitId, 10);
      if (!isNaN(campusId)) {
        const campus = await prisma.campus.findFirst({
          where: { id: campusId },
          select: { fullUnitPath: true },
        });

        if (campus) {
          where.unitPath = { startsWith: campus.fullUnitPath };
        }
      }
    }

    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [data, total] = await prisma.$transaction([
      prisma.membership.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          campus: {
            select: {
              id: true,
              name: true,
              fullUnitPath: true,
            },
          },
        },
      }),
      prisma.membership.count({ where }),
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
      error instanceof Error ? error.message : "Failed to fetch memberships";
    console.error("Membership list error:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
