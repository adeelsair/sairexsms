import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import { updateMembershipSchema } from "@/lib/validations/membership";
import {
  resolveUnitScope,
  assertInviterScope,
  validateRoleForStructure,
} from "@/lib/services/membership.service";
import { roleRequiresUnit } from "@/lib/validations/membership-invite";
import type { MembershipRole } from "@/lib/generated/prisma";
import { logMembershipAudit, detectChangeAction } from "@/lib/services/rbac-audit.service";
import { getRequestContext } from "@/lib/audit/request-context";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/memberships/:id
 * Change a member's role and/or unit scope.
 */
export async function PATCH(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  const membershipId = parseInt(id, 10);
  if (isNaN(membershipId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid membership ID" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = updateMembershipSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "Membership not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard) && membership.organizationId !== guard.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Cross-organization operation not allowed" },
        { status: 403 },
      );
    }

    if (
      membership.role === "ORG_ADMIN" &&
      !isSuperAdmin(guard) &&
      guard.role !== "ORG_ADMIN"
    ) {
      return NextResponse.json(
        { ok: false, error: "Only ORG_ADMIN can modify another ORG_ADMIN" },
        { status: 403 },
      );
    }

    if (!isSuperAdmin(guard) && membership.unitPath) {
      assertInviterScope(
        guard.role,
        guard.unitPath,
        membership.unitPath,
      );
    }

    let orgStructure = guard.organizationStructure;
    if (isSuperAdmin(guard) && !orgStructure) {
      const org = await prisma.organization.findUnique({
        where: { id: membership.organizationId },
        select: { organizationStructure: true },
      });
      orgStructure =
        org?.organizationStructure === "SINGLE" || org?.organizationStructure === "MULTIPLE"
          ? org.organizationStructure
          : null;
    }

    validateRoleForStructure(parsed.data.role, orgStructure);

    const reqCtx = getRequestContext(request);
    const oldRole = membership.role;
    const oldUnitPath = membership.unitPath;

    const result = await prisma.$transaction(async (tx) => {
      let resolvedUnitId: string | null = null;
      let unitPath: string | null = null;
      let campusId: number | null = null;

      if (roleRequiresUnit(parsed.data.role)) {
        if (!parsed.data.unitId) {
          throw new Error("A unit must be selected for this role");
        }

        const scope = await resolveUnitScope(
          tx,
          parsed.data.role as MembershipRole,
          parsed.data.unitId,
          membership.organizationId,
        );

        if (!isSuperAdmin(guard)) {
          assertInviterScope(guard.role, guard.unitPath, scope.unitPath);
        }

        resolvedUnitId = scope.unitId;
        unitPath = scope.unitPath;
        campusId = scope.campusId;
      }

      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: {
          role: parsed.data.role as MembershipRole,
          unitId: resolvedUnitId,
          unitPath,
          campusId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          campus: { select: { id: true, name: true, fullUnitPath: true } },
        },
      });

      const action = detectChangeAction(
        oldRole,
        updated.role,
        oldUnitPath,
        updated.unitPath,
      );

      await logMembershipAudit(tx, {
        organizationId: membership.organizationId,
        action,
        actorUserId: guard.id,
        targetUserId: membership.userId,
        membershipId: membership.id,
        oldRole,
        newRole: updated.role,
        oldUnitPath,
        newUnitPath: updated.unitPath,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
      });

      return updated;
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update membership";

    if (
      message.includes("outside your scope") ||
      message.includes("does not allow") ||
      message.includes("not available for single") ||
      message.includes("belongs to another")
    ) {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }

    console.error("Membership update error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update membership" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/memberships/:id
 * Soft-revoke: sets status to SUSPENDED. No hard delete.
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { id } = await ctx.params;
  const membershipId = parseInt(id, 10);
  if (isNaN(membershipId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid membership ID" },
      { status: 400 },
    );
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "Membership not found" },
        { status: 404 },
      );
    }

    if (!isSuperAdmin(guard) && membership.organizationId !== guard.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Cross-organization operation not allowed" },
        { status: 403 },
      );
    }

    if (!isSuperAdmin(guard) && membership.unitPath) {
      assertInviterScope(guard.role, guard.unitPath, membership.unitPath);
    }

    if (membership.userId === guard.id) {
      return NextResponse.json(
        { ok: false, error: "You cannot revoke your own access" },
        { status: 403 },
      );
    }

    if (
      membership.role === "ORG_ADMIN" &&
      !isSuperAdmin(guard) &&
      guard.role !== "ORG_ADMIN"
    ) {
      return NextResponse.json(
        { ok: false, error: "Only ORG_ADMIN can revoke another ORG_ADMIN" },
        { status: 403 },
      );
    }

    const reqCtx = getRequestContext(request);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.membership.update({
        where: { id: membership.id },
        data: { status: "SUSPENDED" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await logMembershipAudit(tx, {
        organizationId: membership.organizationId,
        action: "MEMBERSHIP_REVOKED",
        actorUserId: guard.id,
        targetUserId: membership.userId,
        membershipId: membership.id,
        oldRole: membership.role,
        oldUnitPath: membership.unitPath,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
      });

      return result;
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke membership";

    if (message.includes("outside your scope")) {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }

    console.error("Membership revoke error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to revoke membership" },
      { status: 500 },
    );
  }
}
