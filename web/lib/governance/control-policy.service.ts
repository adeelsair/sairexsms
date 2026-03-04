/**
 * Control Policy Service — Centralized vs Campus-Autonomous Governance
 *
 * Enforces organizational control modes for fee management, academic
 * operations, messaging, and fee posting. When a domain is CENTRALIZED,
 * campus-level users are blocked from modifying resources in that domain.
 *
 * Also manages campus operational locks (financial/academic freeze).
 */
import { prisma } from "@/lib/prisma";
import type { ControlMode } from "@/lib/generated/prisma";

/* ── Types ────────────────────────────────────────────── */

export type PolicyDomain = "fee" | "academic" | "messaging" | "posting";

interface PolicyState {
  feeControlMode: ControlMode;
  academicControlMode: ControlMode;
  messagingControlMode: ControlMode;
  postingControlMode: ControlMode;
}

interface CampusLockState {
  campusId: number;
  isFinancialLocked: boolean;
  isAcademicLocked: boolean;
  lockReason: string | null;
  lockedByUserId: number | null;
  lockedAt: Date | null;
}

/* ── Control Policy CRUD ──────────────────────────────── */

export async function getControlPolicy(
  organizationId: string,
): Promise<PolicyState> {
  const policy = await prisma.organizationControlPolicy.findUnique({
    where: { organizationId },
  });

  if (!policy) {
    return {
      feeControlMode: "CAMPUS_AUTONOMOUS",
      academicControlMode: "CAMPUS_AUTONOMOUS",
      messagingControlMode: "CAMPUS_AUTONOMOUS",
      postingControlMode: "CAMPUS_AUTONOMOUS",
    };
  }

  return {
    feeControlMode: policy.feeControlMode,
    academicControlMode: policy.academicControlMode,
    messagingControlMode: policy.messagingControlMode,
    postingControlMode: policy.postingControlMode,
  };
}

export async function updateControlPolicy(
  organizationId: string,
  updates: Partial<PolicyState>,
) {
  return prisma.organizationControlPolicy.upsert({
    where: { organizationId },
    create: {
      organizationId,
      feeControlMode: updates.feeControlMode ?? "CAMPUS_AUTONOMOUS",
      academicControlMode: updates.academicControlMode ?? "CAMPUS_AUTONOMOUS",
      messagingControlMode: updates.messagingControlMode ?? "CAMPUS_AUTONOMOUS",
      postingControlMode: updates.postingControlMode ?? "CAMPUS_AUTONOMOUS",
    },
    update: updates,
  });
}

/* ── Policy Enforcement ───────────────────────────────── */

/**
 * Checks whether a campus-level user is blocked from modifying a domain.
 * ORG_ADMIN is never blocked. Only campus-scoped roles are subject to policy.
 *
 * Returns { blocked: true, reason } if the operation is denied.
 */
export async function enforceCentralizedPolicy(params: {
  organizationId: string;
  role: string;
  domain: PolicyDomain;
}): Promise<{ blocked: boolean; reason?: string }> {
  const { organizationId, role, domain } = params;

  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN") {
    return { blocked: false };
  }

  const policy = await getControlPolicy(organizationId);

  const modeMap: Record<PolicyDomain, ControlMode> = {
    fee: policy.feeControlMode,
    academic: policy.academicControlMode,
    messaging: policy.messagingControlMode,
    posting: policy.postingControlMode,
  };

  if (modeMap[domain] === "CENTRALIZED") {
    return {
      blocked: true,
      reason: `${domain} management is centralized. Only Head Office can modify this.`,
    };
  }

  return { blocked: false };
}

/* ── Campus Operational Lock ──────────────────────────── */

export async function getCampusLockStatus(
  campusId: number,
): Promise<CampusLockState> {
  const status = await prisma.campusOperationalStatus.findUnique({
    where: { campusId },
  });

  if (!status) {
    return {
      campusId,
      isFinancialLocked: false,
      isAcademicLocked: false,
      lockReason: null,
      lockedByUserId: null,
      lockedAt: null,
    };
  }

  return {
    campusId: status.campusId,
    isFinancialLocked: status.isFinancialLocked,
    isAcademicLocked: status.isAcademicLocked,
    lockReason: status.lockReason,
    lockedByUserId: status.lockedByUserId,
    lockedAt: status.lockedAt,
  };
}

export async function lockCampus(params: {
  campusId: number;
  financial?: boolean;
  academic?: boolean;
  reason?: string;
  userId: number;
}) {
  const { campusId, financial, academic, reason, userId } = params;

  return prisma.campusOperationalStatus.upsert({
    where: { campusId },
    create: {
      campusId,
      isFinancialLocked: financial ?? false,
      isAcademicLocked: academic ?? false,
      lockReason: reason,
      lockedByUserId: userId,
      lockedAt: new Date(),
    },
    update: {
      ...(financial !== undefined && { isFinancialLocked: financial }),
      ...(academic !== undefined && { isAcademicLocked: academic }),
      lockReason: reason,
      lockedByUserId: userId,
      lockedAt: new Date(),
    },
  });
}

export async function unlockCampus(campusId: number) {
  return prisma.campusOperationalStatus.upsert({
    where: { campusId },
    create: {
      campusId,
      isFinancialLocked: false,
      isAcademicLocked: false,
    },
    update: {
      isFinancialLocked: false,
      isAcademicLocked: false,
      lockReason: null,
      lockedByUserId: null,
      lockedAt: null,
    },
  });
}

/**
 * Guard: checks both centralized policy AND operational lock.
 * Returns { blocked, reason } if the operation should be denied.
 */
export async function enforceOperationalGuard(params: {
  organizationId: string;
  campusId: number;
  role: string;
  domain: PolicyDomain;
}): Promise<{ blocked: boolean; reason?: string }> {
  const policyCheck = await enforceCentralizedPolicy({
    organizationId: params.organizationId,
    role: params.role,
    domain: params.domain,
  });

  if (policyCheck.blocked) return policyCheck;

  const lockStatus = await getCampusLockStatus(params.campusId);

  if (params.domain === "fee" || params.domain === "posting") {
    if (lockStatus.isFinancialLocked) {
      return {
        blocked: true,
        reason: `Campus is financially locked${lockStatus.lockReason ? `: ${lockStatus.lockReason}` : ""}`,
      };
    }
  }

  if (params.domain === "academic") {
    if (lockStatus.isAcademicLocked) {
      return {
        blocked: true,
        reason: `Campus is academically locked${lockStatus.lockReason ? `: ${lockStatus.lockReason}` : ""}`,
      };
    }
  }

  return { blocked: false };
}

/* ── Fee Template CRUD ────────────────────────────────── */

export async function getFeeTemplates(organizationId: string) {
  return prisma.feeTemplate.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createFeeTemplate(params: {
  organizationId: string;
  name: string;
  amount: number;
  frequency?: "MONTHLY" | "TERM" | "ANNUAL";
  applicableGrade?: string;
}) {
  return prisma.feeTemplate.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      amount: params.amount,
      frequency: params.frequency ?? "MONTHLY",
      applicableGrade: params.applicableGrade,
    },
  });
}

export async function updateFeeTemplate(
  id: string,
  data: {
    name?: string;
    amount?: number;
    frequency?: "MONTHLY" | "TERM" | "ANNUAL";
    applicableGrade?: string;
    isActive?: boolean;
  },
) {
  return prisma.feeTemplate.update({
    where: { id },
    data,
  });
}

export async function deleteFeeTemplate(id: string) {
  return prisma.feeTemplate.update({
    where: { id },
    data: { isActive: false },
  });
}
