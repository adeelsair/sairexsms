import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/actions
 *
 * Admin view: list all custom dashboard action overrides for this organization.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId && !isSuperAdmin(guard)) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const actions = await prisma.dashboardAction.findMany({
      where: orgId ? { organizationId: orgId } : {},
      orderBy: [{ role: "asc" }, { displayOrder: "asc" }],
    });

    return NextResponse.json({ actions });
  } catch (err) {
    console.error("[Dashboard Actions] List error:", err);
    return NextResponse.json({ error: "Failed to load actions" }, { status: 500 });
  }
}

/**
 * POST /api/dashboard/actions
 *
 * Admin: create or update a custom dashboard action for this organization.
 *
 * Body: { role, actionKey, label, icon, route, category?, enabled?, displayOrder? }
 *
 * Uses upsert on (organizationId, role, actionKey) to prevent duplicates.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  const orgId = guard.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { role, actionKey, label, icon, route, category, enabled, displayOrder } = body;

    if (!role || !actionKey || !label || !icon || !route) {
      return NextResponse.json(
        { error: "role, actionKey, label, icon, and route are required" },
        { status: 400 },
      );
    }

    const action = await prisma.dashboardAction.upsert({
      where: {
        organizationId_role_actionKey: {
          organizationId: orgId,
          role,
          actionKey,
        },
      },
      create: {
        organizationId: orgId,
        role,
        actionKey,
        label,
        icon,
        route,
        category: category ?? "primary",
        enabled: enabled ?? true,
        displayOrder: displayOrder ?? 0,
      },
      update: {
        label,
        icon,
        route,
        category: category ?? undefined,
        enabled: enabled ?? undefined,
        displayOrder: displayOrder ?? undefined,
      },
    });

    return NextResponse.json(action, { status: 201 });
  } catch (err) {
    console.error("[Dashboard Actions] Create error:", err);
    return NextResponse.json({ error: "Failed to save action" }, { status: 500 });
  }
}
