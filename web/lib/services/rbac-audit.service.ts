import type { AuditAction, MembershipRole } from "@/lib/generated/prisma";

type TransactionClient = Parameters<
  Parameters<typeof import("@/lib/prisma").prisma.$transaction>[0]
>[0];

export interface AuditEntry {
  organizationId: string;
  action: AuditAction;
  actorUserId: number;
  targetUserId: number;
  membershipId: number;
  oldRole?: MembershipRole | null;
  newRole?: MembershipRole | null;
  oldUnitPath?: string | null;
  newUnitPath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes one RBAC audit entry. Must be called inside a Prisma transaction
 * so the log is committed atomically with the membership change.
 */
export async function logMembershipAudit(
  tx: TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.rbacAuditLog.create({
    data: {
      organizationId: entry.organizationId,
      action: entry.action,
      actorUserId: entry.actorUserId,
      targetUserId: entry.targetUserId,
      membershipId: entry.membershipId,
      oldRole: entry.oldRole ?? null,
      newRole: entry.newRole ?? null,
      oldUnitPath: entry.oldUnitPath ?? null,
      newUnitPath: entry.newUnitPath ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}

/**
 * Determines the correct AuditAction when a membership is updated.
 */
export function detectChangeAction(
  oldRole: MembershipRole,
  newRole: MembershipRole,
  oldUnitPath: string | null,
  newUnitPath: string | null,
): AuditAction {
  if (oldRole !== newRole) return "MEMBERSHIP_ROLE_CHANGED";
  if (oldUnitPath !== newUnitPath) return "MEMBERSHIP_SCOPE_CHANGED";
  return "MEMBERSHIP_ROLE_CHANGED";
}
