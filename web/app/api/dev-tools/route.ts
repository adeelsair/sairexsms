import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guard";

/**
 * GET /api/dev-tools
 *
 * Returns all users (split into pending/all) and all organizations.
 * SUPER_ADMIN only.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const [allUsers, allOrgs] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { organization: { select: { id: true, organizationName: true } } },
            take: 1,
          },
        },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { memberships: true, campuses: true, students: true },
          },
        },
      }),
    ]);

    const unverified = allUsers.filter(
      (u) => !u.emailVerifiedAt && !u.platformRole,
    );

    const noOrg = allUsers.filter(
      (u) => u.emailVerifiedAt && u.memberships.length === 0 && !u.platformRole,
    );

    const users = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      emailVerified: !!u.emailVerifiedAt,
      platformRole: u.platformRole,
      membershipRole: u.memberships[0]?.role ?? null,
      organizationId: u.memberships[0]?.organization?.id ?? null,
      organizationName: u.memberships[0]?.organization?.organizationName ?? null,
      createdAt: u.createdAt.toISOString(),
    }));

    const pending = {
      unverified: unverified.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt.toISOString(),
      })),
      noOrg: noOrg.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt.toISOString(),
      })),
    };

    const organizations = allOrgs.map((o) => ({
      id: o.id,
      organizationName: o.organizationName,
      displayName: o.displayName,
      slug: o.slug,
      organizationCategory: o.organizationCategory,
      organizationStructure: o.organizationStructure,
      status: o.status,
      onboardingStep: o.onboardingStep,
      createdAt: o.createdAt.toISOString(),
      _count: o._count,
    }));

    return NextResponse.json({ pending, users, organizations });
  } catch (error) {
    console.error("Dev-tools GET error:", error);
    return NextResponse.json(
      { error: "Failed to load dev-tools data" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dev-tools
 *
 * Permanently deletes a user or organization and all related records.
 * Body: { type: "user" | "organization", id: number | string }
 * SUPER_ADMIN only.
 */
export async function DELETE(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const { type, id } = await request.json();

    if (type === "user") {
      const userId = Number(id);
      if (!userId || isNaN(userId)) {
        return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
      }

      if (userId === guard.id) {
        return NextResponse.json(
          { error: "You cannot delete your own account" },
          { status: 403 },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.invitation.deleteMany({ where: { invitedById: userId } });
        await tx.membership.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      });

      return NextResponse.json({ message: `User ${id} permanently deleted` });
    }

    if (type === "organization") {
      const orgId = String(id);

      await prisma.$transaction(async (tx) => {
        await tx.feeChallan.deleteMany({ where: { organizationId: orgId } });
        await tx.feeStructure.deleteMany({ where: { organizationId: orgId } });
        await tx.feeHead.deleteMany({ where: { organizationId: orgId } });
        await tx.student.deleteMany({ where: { organizationId: orgId } });
        await tx.membership.deleteMany({ where: { organizationId: orgId } });
        await tx.invitation.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationContact.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationAddress.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationBank.deleteMany({ where: { organizationId: orgId } });
        await tx.campus.deleteMany({ where: { organizationId: orgId } });
        await tx.organization.delete({ where: { id: orgId } });
      });

      return NextResponse.json({ message: `Organization ${id} permanently deleted` });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Dev-tools DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 },
    );
  }
}
