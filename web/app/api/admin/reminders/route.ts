import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { requireAuth, requireRole, isSuperAdmin, type AuthUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function buildReminderScope(guard: AuthUser, orgId: string): Prisma.ReminderLogWhereInput {
  const base: Prisma.ReminderLogWhereInput = { organizationId: orgId };

  if (isSuperAdmin(guard) || guard.organizationStructure === "SINGLE" || guard.role === "ORG_ADMIN") {
    return base;
  }

  if (guard.role === "REGION_ADMIN" || guard.role === "SUBREGION_ADMIN" || guard.role === "ZONE_ADMIN") {
    if (!guard.unitPath) return base;
    return {
      ...base,
      challan: {
        is: {
          campus: {
            fullUnitPath: { startsWith: guard.unitPath },
          },
        },
      },
    };
  }

  if (guard.role === "CAMPUS_ADMIN" && guard.unitPath) {
    return {
      ...base,
      challan: {
        is: {
          campus: {
            fullUnitPath: guard.unitPath,
          },
        },
      },
    };
  }

  if (guard.campusId) {
    return {
      ...base,
      challan: {
        is: {
          campusId: guard.campusId,
        },
      },
    };
  }

  if (guard.unitPath) {
    return {
      ...base,
      challan: {
        is: {
          campus: {
            fullUnitPath: guard.unitPath,
          },
        },
      },
    };
  }

  return base;
}

/**
 * GET /api/admin/reminders?take=100
 *
 * Tenant-scoped reminder delivery history for admin surfaces.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "REGION_ADMIN", "CAMPUS_ADMIN");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = guard.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    const takeRaw = Number(searchParams.get("take") ?? "100");
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 100;
    const where = buildReminderScope(guard, organizationId);

    const logs = await prisma.reminderLog.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take,
      include: {
        student: {
          select: {
            fullName: true,
            admissionNo: true,
          },
        },
        challan: {
          select: {
            id: true,
            challanNo: true,
            dueDate: true,
          },
        },
        reminderRule: {
          select: {
            name: true,
            triggerType: true,
          },
        },
      },
    });

    return NextResponse.json({
      logs,
      total: logs.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reminder history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
