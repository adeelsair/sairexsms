import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@/lib/generated/prisma";
import { roleRequiresUnit, SINGLE_STRUCTURE_ROLES } from "@/lib/validations/membership-invite";
import { logMembershipAudit } from "@/lib/services/rbac-audit.service";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface ResolvedScope {
  unitId: string;
  unitPath: string;
  campusId: number | null;
}

/**
 * Resolves the unitPath for a given role + unitId by walking up the geo hierarchy.
 * This produces the same prefix structure used in campus.fullUnitPath so that
 * scopeFilter prefix matching works correctly.
 */
export async function resolveUnitScope(
  tx: TransactionClient,
  role: MembershipRole,
  unitId: string,
  organizationId: string,
): Promise<ResolvedScope> {
  switch (role) {
    case "REGION_ADMIN": {
      const region = await tx.region.findUnique({
        where: { id: unitId },
        select: { id: true, unitCode: true, organizationId: true },
      });
      if (!region) throw new Error("Region not found");
      if (region.organizationId !== organizationId) throw new Error("Region belongs to another organization");
      return { unitId: region.id, unitPath: region.unitCode, campusId: null };
    }

    case "SUBREGION_ADMIN": {
      const sub = await tx.subRegion.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          unitCode: true,
          organizationId: true,
          region: { select: { unitCode: true } },
        },
      });
      if (!sub) throw new Error("SubRegion not found");
      if (sub.organizationId !== organizationId) throw new Error("SubRegion belongs to another organization");
      const parts = [sub.region?.unitCode, sub.unitCode].filter(Boolean);
      return { unitId: sub.id, unitPath: parts.join("-"), campusId: null };
    }

    case "ZONE_ADMIN": {
      const zone = await tx.zone.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          unitCode: true,
          organizationId: true,
          city: {
            select: {
              unitCode: true,
              region: { select: { unitCode: true } },
              subRegion: { select: { unitCode: true } },
            },
          },
        },
      });
      if (!zone) throw new Error("Zone not found");
      if (zone.organizationId !== organizationId) throw new Error("Zone belongs to another organization");
      const parts = [
        zone.city.region?.unitCode,
        zone.city.subRegion?.unitCode,
        zone.city.unitCode,
        zone.unitCode,
      ].filter(Boolean);
      return { unitId: zone.id, unitPath: parts.join("-"), campusId: null };
    }

    case "CAMPUS_ADMIN":
    case "TEACHER":
    case "ACCOUNTANT":
    case "STAFF":
    case "PARENT":
    default: {
      const campusIdNum = parseInt(unitId, 10);
      if (isNaN(campusIdNum)) throw new Error("Invalid campus ID");
      const campus = await tx.campus.findUnique({
        where: { id: campusIdNum },
        select: { id: true, fullUnitPath: true, organizationId: true },
      });
      if (!campus) throw new Error("Campus not found");
      if (campus.organizationId !== organizationId) throw new Error("Campus belongs to another organization");
      return { unitId: String(campus.id), unitPath: campus.fullUnitPath, campusId: campus.id };
    }
  }
}

/**
 * Verifies the inviter has authority to assign the target scope.
 * ORG_ADMIN can assign anywhere in their org.
 * Hierarchical admins can only assign within their own unitPath prefix.
 */
export function assertInviterScope(
  inviterRole: string | null,
  inviterUnitPath: string | null,
  targetUnitPath: string,
): void {
  if (inviterRole === "ORG_ADMIN") return;

  if (!inviterUnitPath) {
    throw new Error("Your scope does not allow assigning roles");
  }

  if (!targetUnitPath.startsWith(inviterUnitPath)) {
    throw new Error("Cannot assign a role outside your scope");
  }
}

/**
 * Validates that the role is allowed for the given organization structure.
 */
export function validateRoleForStructure(
  role: string,
  structure: string | null,
): void {
  if (structure === "SINGLE") {
    if (!(SINGLE_STRUCTURE_ROLES as readonly string[]).includes(role)) {
      throw new Error(
        `Role "${role}" is not available for single-structure organizations`,
      );
    }
  }
}

/**
 * Full invite flow: find-or-create user, create membership with scope.
 * Returns the created membership.
 */
export async function inviteMember(params: {
  email: string;
  name?: string;
  role: MembershipRole;
  unitId?: string;
  session: { organizationId?: string | null };
  organizationStructure: string | null;
  inviterRole: string | null;
  inviterUnitPath: string | null;
  actorUserId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const {
    email,
    name,
    role,
    unitId,
    session,
    organizationStructure,
    inviterRole,
    inviterUnitPath,
    actorUserId,
    ipAddress,
    userAgent,
  } = params;
  const organizationId = session.organizationId ?? "";
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  validateRoleForStructure(role, organizationStructure);

  return prisma.$transaction(async (tx) => {
    let resolvedScope: ResolvedScope | null = null;

    if (roleRequiresUnit(role)) {
      if (!unitId) throw new Error("A unit must be selected for this role");

      resolvedScope = await resolveUnitScope(tx, role, unitId, organizationId);
      assertInviterScope(inviterRole, inviterUnitPath, resolvedScope.unitPath);
    }

    let user = await tx.user.findUnique({ where: { email } });
    let userCreated = false;

    if (!user) {
      const bcrypt = await import("bcryptjs");
      const tempPassword = await bcrypt.default.hash(
        `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        10,
      );

      user = await tx.user.create({
        data: {
          email,
          name: name ?? email.split("@")[0],
          password: tempPassword,
          isActive: true,
        },
      });
      userCreated = true;
    }

    const membershipData = {
      role,
      status: "ACTIVE" as const,
      campusId: resolvedScope?.campusId ?? null,
      unitId: resolvedScope?.unitId ?? null,
      unitPath: resolvedScope?.unitPath ?? null,
    };

    const before = await tx.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      select: { id: true, role: true, unitPath: true },
    });

    const membership = await tx.membership.upsert({
      where: {
        userId_organizationId: { userId: user.id, organizationId },
      },
      update: membershipData,
      create: {
        userId: user.id,
        organizationId,
        ...membershipData,
      },
    });

    await logMembershipAudit(tx, {
      organizationId,
      action: "MEMBERSHIP_INVITED",
      actorUserId,
      targetUserId: user.id,
      membershipId: membership.id,
      oldRole: before?.role ?? null,
      newRole: membership.role,
      oldUnitPath: before?.unitPath ?? null,
      newUnitPath: membership.unitPath,
      ipAddress,
      userAgent,
    });

    return { membership, userCreated, updated: !!before };
  });
}
