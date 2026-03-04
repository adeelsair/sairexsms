import { prisma } from "@/lib/prisma";
import { TRIAL_POLICY, createTrialWindow } from "@/lib/billing/pricing-architecture";
import type { AuditActorContext } from "@/lib/audit/resolve-audit-actor";
import { Prisma } from "@prisma/client";

export interface BillingConfig {
  organizationId: string;
  perStudentFee: number;
  revenueCalculationMode: "ON_GENERATED_FEE" | "ON_COLLECTED_FEE";
  closingDay: number;
}

export async function getOrganizationBillingConfig(
  organizationId: string,
): Promise<BillingConfig> {
  const plan = await prisma.organizationPlan.findUnique({
    where: { organizationId },
    select: {
      organizationId: true,
      perStudentFee: true,
      revenueCalculationMode: true,
      closingDay: true,
    },
  });

  return {
    organizationId,
    perStudentFee: Number(plan?.perStudentFee ?? 0),
    revenueCalculationMode: (plan?.revenueCalculationMode ?? "ON_GENERATED_FEE"),
    closingDay: plan?.closingDay ?? 10,
  };
}

export async function updateOrganizationBillingConfig(input: {
  organizationId: string;
  perStudentFee: number;
  revenueCalculationMode: "ON_GENERATED_FEE" | "ON_COLLECTED_FEE";
  closingDay: number;
  changedByUserId: number;
  changedByEmail: string;
  auditActor?: AuditActorContext;
}): Promise<BillingConfig> {
  const previous = await getOrganizationBillingConfig(input.organizationId);
  const trial = createTrialWindow();

  const updated = await prisma.organizationPlan.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      perStudentFee: input.perStudentFee,
      revenueCalculationMode: input.revenueCalculationMode,
      closingDay: input.closingDay,
      planType: "FREE",
      active: true,
      trialPlanType: TRIAL_POLICY.trialPlanType,
      trialStartedAt: trial.trialStartedAt,
      trialEndsAt: trial.trialEndsAt,
    },
    update: {
      perStudentFee: input.perStudentFee,
      revenueCalculationMode: input.revenueCalculationMode,
      closingDay: input.closingDay,
    },
    select: {
      organizationId: true,
      perStudentFee: true,
      revenueCalculationMode: true,
      closingDay: true,
    },
  });

  const payloadJson = {
    oldValue: previous,
    newValue: {
      perStudentFee: input.perStudentFee,
      revenueCalculationMode: input.revenueCalculationMode,
      closingDay: input.closingDay,
    },
    changedBy: input.changedByEmail,
    changedByUserId: input.changedByUserId,
    changedAt: new Date().toISOString(),
    _audit: {
      actorUserId: input.auditActor?.actorUserId ?? input.changedByUserId,
      effectiveUserId: input.auditActor?.effectiveUserId ?? input.changedByUserId,
      tenantId: input.auditActor?.tenantId ?? input.organizationId,
      impersonation: input.auditActor?.impersonation ?? false,
      impersonatedTenantId: input.auditActor?.impersonation
        ? input.auditActor.tenantId
        : null,
    },
  } as unknown as Prisma.InputJsonValue;

  await prisma.domainEventLog.create({
    data: {
      organizationId: input.organizationId,
      eventType: "OrganizationBillingConfigUpdated",
      payload: payloadJson,
      occurredAt: new Date(),
      initiatedByUserId: input.auditActor?.actorUserId ?? input.changedByUserId,
    },
  });

  return {
    organizationId: updated.organizationId,
    perStudentFee: Number(updated.perStudentFee),
    revenueCalculationMode: updated.revenueCalculationMode,
    closingDay: updated.closingDay,
  };
}

