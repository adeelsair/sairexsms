import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { organizationScalarSelectSafe } from "@/lib/prisma/organization-safe-select";

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
        select: {
          ...organizationScalarSelectSafe,
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
    const body = await request.json().catch(() => ({}));
    const { type, id } = body as { type?: string; id?: unknown };

    if (type === "user") {
      const userId = Number(id);
      if (!userId || isNaN(userId)) {
        return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, platformRole: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (targetUser.platformRole === "SUPER_ADMIN") {
        return NextResponse.json(
          { error: "SUPER_ADMIN users cannot be deleted via dev-tools" },
          { status: 403 },
        );
      }
      if (userId === guard.id) {
        return NextResponse.json(
          { error: "You cannot delete your own account" },
          { status: 403 },
        );
      }

      const createdOrg = await prisma.organization.findFirst({
        where: { createdByUserId: userId },
        select: { id: true },
      });
      if (createdOrg) {
        return NextResponse.json(
          { error: "User created an organization. Delete the organization first." },
          { status: 403 },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.rbacAuditLog.deleteMany({
          where: { OR: [{ actorUserId: userId }, { targetUserId: userId }] },
        });
        await tx.job.deleteMany({ where: { userId } });
        await tx.postingRun.deleteMany({ where: { createdByUserId: userId } });
        await tx.promotionRun.deleteMany({ where: { initiatedByUserId: userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.verificationCode.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.invitation.deleteMany({ where: { invitedById: userId } });
        const memberships = await tx.membership.findMany({
          where: { userId },
          select: { id: true },
        });
        const membershipIds = memberships.map((m) => m.id);
        if (membershipIds.length > 0) {
          await tx.attendance.deleteMany({
            where: { markedById: { in: membershipIds } },
          });
        }
        await tx.membership.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      });

      return NextResponse.json({ message: `User ${id} permanently deleted` });
    }

    if (type === "organization") {
      const orgId = String(id);
      if (!orgId || orgId.length < 2) {
        return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
      }

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        // Sessions and audit (no cascade from Organization in some DBs)
        await tx.session.deleteMany({ where: { organizationId: orgId } });
        await tx.rbacAuditLog.deleteMany({ where: { organizationId: orgId } });
        await tx.domainEventLog.deleteMany({ where: { organizationId: orgId } });
        await tx.job.deleteMany({ where: { organizationId: orgId } });
        await tx.onboardingProgress.deleteMany({ where: { organizationId: orgId } });
        await tx.dashboardAction.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationPlan.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationControlPolicy.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationPaymentConfig.deleteMany({ where: { organizationId: orgId } });
        await tx.messageTemplate.deleteMany({ where: { organizationId: orgId } });
        await tx.feeTemplate.deleteMany({ where: { organizationId: orgId } });
        await tx.mediaAsset.deleteMany({ where: { organizationId: orgId } });
        await tx.qrToken.deleteMany({ where: { organizationId: orgId } });
        await tx.qRInviteToken.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationDailyStats.deleteMany({ where: { organizationId: orgId } });
        await tx.operationalBriefSnapshot.deleteMany({ where: { organizationId: orgId } });
        await tx.operationalRiskSnapshot.deleteMany({ where: { organizationId: orgId } });
        await tx.mobileActionLog.deleteMany({ where: { organizationId: orgId } });
        await tx.reminderLog.deleteMany({ where: { organizationId: orgId } });
        await tx.reminderRule.deleteMany({ where: { organizationId: orgId } });
        await tx.ledgerEntry.deleteMany({ where: { organizationId: orgId } });
        await tx.paymentRecord.deleteMany({ where: { organizationId: orgId } });
        await tx.attendance.deleteMany({ where: { organizationId: orgId } });
        await tx.studentExamResult.deleteMany({ where: { organizationId: orgId } });
        await tx.exam.deleteMany({ where: { organizationId: orgId } });
        await tx.subject.deleteMany({ where: { organizationId: orgId } });
        // StudentEnrollment references Class and Section — delete before them
        await tx.studentEnrollment.deleteMany({ where: { organizationId: orgId } });
        await tx.section.deleteMany({ where: { organizationId: orgId } });
        await tx.class.deleteMany({ where: { organizationId: orgId } });
        await tx.academicYear.deleteMany({ where: { organizationId: orgId } });
        await tx.revenueAdjustment.deleteMany({ where: { organizationId: orgId } });
        await tx.revenueCycle.deleteMany({ where: { organizationId: orgId } });
        await tx.postingRun.deleteMany({ where: { organizationId: orgId } });
        await tx.promotionRun.deleteMany({ where: { organizationId: orgId } });
        await tx.studentFinancialSummary.deleteMany({ where: { organizationId: orgId } });
        await tx.gradeScale.deleteMany({ where: { organizationId: orgId } });
        await tx.feeChallan.deleteMany({ where: { organizationId: orgId } });
        await tx.feeStructure.deleteMany({ where: { organizationId: orgId } });
        await tx.feeHead.deleteMany({ where: { organizationId: orgId } });
        await tx.student.deleteMany({ where: { organizationId: orgId } });
        await tx.campusHealthScore.deleteMany({ where: { organizationId: orgId } });
        await tx.campus.deleteMany({ where: { organizationId: orgId } });
        await tx.zone.deleteMany({ where: { organizationId: orgId } });
        await tx.city.deleteMany({ where: { organizationId: orgId } });
        await tx.subRegion.deleteMany({ where: { organizationId: orgId } });
        await tx.region.deleteMany({ where: { organizationId: orgId } });
        await tx.unitBankAccount.deleteMany({ where: { organizationId: orgId } });
        await tx.unitProfile.deleteMany({ where: { organizationId: orgId } });
        await tx.unitCodeSequence.deleteMany({ where: { organizationId: orgId } });
        await tx.membership.deleteMany({ where: { organizationId: orgId } });
        await tx.invitation.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationContact.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationAddress.deleteMany({ where: { organizationId: orgId } });
        await tx.organizationBank.deleteMany({ where: { organizationId: orgId } });
        await tx.organization.delete({ where: { id: orgId } });
      });

      return NextResponse.json({ message: `Organization ${id} permanently deleted` });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete record";
    console.error("Dev-tools DELETE error:", error);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
