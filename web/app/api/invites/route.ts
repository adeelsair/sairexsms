import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { scopeFilter, resolveOrgId } from "@/lib/tenant";
import { enqueue, EMAIL_QUEUE } from "@/lib/queue";
import crypto from "crypto";

/**
 * GET /api/invites
 * Lists memberships (users in org), pending invitations, and dropdown options.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const isSA = isSuperAdmin(guard);
    const where = scopeFilter(guard);

    const [memberships, invitations, organizations, campuses] =
      await Promise.all([
        prisma.membership.findMany({
          where: {
            ...where,
            status: "ACTIVE",
          },
          select: {
            id: true,
            role: true,
            campusId: true,
            status: true,
            organization: { select: { id: true, organizationName: true } },
            campus: {
              select: {
                id: true,
                name: true,
                city: { select: { id: true, name: true } },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                platformRole: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.invitation.findMany({
          where: {
            ...where,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            invitedBy: { select: { email: true, name: true } },
            createdAt: true,
            organization: { select: { organizationName: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        isSA
          ? prisma.organization.findMany({
              select: { id: true, organizationName: true },
              orderBy: { organizationName: "asc" },
            })
          : prisma.organization.findMany({
              where: { id: guard.organizationId ?? undefined },
              select: { id: true, organizationName: true },
            }),
        prisma.campus.findMany({
          where,
          select: {
            id: true,
            name: true,
            organizationId: true,
            city: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        }),
      ]);

    const users = memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.user.platformRole ?? m.role,
      isActive: m.user.isActive,
      campusId: m.campusId,
      organization: m.organization,
      campus: m.campus,
      membershipId: m.id,
    }));

    return NextResponse.json({
      users,
      pendingInvites: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdBy: inv.invitedBy.email,
        createdAt: inv.createdAt,
        organization: inv.organization,
      })),
      organizations,
      campuses,
      isSuperAdmin: isSA,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/invites
 * Send an invite — creates an Invitation record and sends email.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 },
      );
    }

    const allowedRoles = [
      "ORG_ADMIN",
      "CAMPUS_ADMIN",
      "TEACHER",
      "ACCOUNTANT",
      "PARENT",
      "STAFF",
    ];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${allowedRoles.join(", ")}` },
        { status: 400 },
      );
    }

    const targetOrgId = resolveOrgId(guard);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          where: { organizationId: targetOrgId, status: "ACTIVE" },
        },
      },
    });

    if (existingUser && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: "This user is already a member of this organization" },
        { status: 409 },
      );
    }

    await prisma.invitation.updateMany({
      where: {
        email: email.toLowerCase(),
        organizationId: targetOrgId,
        acceptedAt: null,
      },
      data: { acceptedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        role: role,
        organizationId: targetOrgId,
        token,
        invitedById: guard.id,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/signup?invite=${token}`;

    await enqueue({
      type: "EMAIL",
      queue: EMAIL_QUEUE,
      userId: guard.id,
      organizationId: targetOrgId,
      payload: {
        to: email,
        subject: "You're invited to SAIREX SMS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e40af;">SAIREX SMS</h2>
            <p>You've been invited to join as <strong>${role.replace("_", " ")}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${inviteUrl}" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Accept Invite
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">
              This invite expires in 7 days. If you didn't expect this, ignore this email.
            </p>
          </div>
        `,
      },
    });

    return NextResponse.json(
      { message: `Invite sent to ${email}`, inviteUrl },
      { status: 201 },
    );
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invite" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/invites
 * Toggle user active/inactive (lock/unlock).
 */
export async function PUT(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (denied) return denied;

  try {
    const { userId, isActive } = await request.json();

    if (!userId || typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "userId and isActive (boolean) are required" },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        memberships: {
          where: { organizationId: guard.organizationId ?? undefined },
          take: 1,
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    if (targetUser.email === guard.email) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 },
      );
    }

    const membership = targetUser.memberships[0];
    if (!membership && !isSuperAdmin(guard)) {
      return NextResponse.json(
        { error: "User does not belong to your organization" },
        { status: 403 },
      );
    }

    if (
      targetUser.platformRole === "SUPER_ADMIN" &&
      !isSuperAdmin(guard)
    ) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can manage other SUPER_ADMIN accounts" },
        { status: 403 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { isActive },
    });

    return NextResponse.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: {
        id: updated.id,
        email: updated.email,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error("Toggle user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}
