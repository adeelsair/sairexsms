import { prisma } from "@/lib/prisma";
import type { RevenueCalculationMode } from "@/lib/generated/prisma";

export interface RevenueMetrics {
  totalStudents: number;
  generatedAmount: number;
  collectedAmount: number;
}

export interface RevenueCycleSummary {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  revenueCalculationModeUsed: RevenueCalculationMode;
  perStudentFeeUsed: number;
  closingDayUsed: number;
  totalStudents: number;
  generatedAmount: number;
  collectedAmount: number;
  sairexRevenue: number;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
}

function monthRangeUtc(month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { from, to };
}

export async function createMonthlyCycles(
  month: number,
  year: number,
): Promise<{ created: number; skipped: number }> {
  const orgs = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      plan: {
        select: {
          revenueCalculationMode: true,
          perStudentFee: true,
          closingDay: true,
        },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const org of orgs) {
    try {
      await prisma.revenueCycle.create({
        data: {
          organizationId: org.id,
          month,
          year,
          revenueCalculationModeUsed:
            org.plan?.revenueCalculationMode ?? "ON_GENERATED_FEE",
          perStudentFeeUsed: Number(org.plan?.perStudentFee ?? 0),
          closingDayUsed: org.plan?.closingDay ?? 10,
          status: "OPEN",
        },
      });
      created += 1;
    } catch (error: unknown) {
      const isUnique =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      if (isUnique) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return { created, skipped };
}

export async function createMonthlyCycleForOrganization(
  organizationId: string,
  month: number,
  year: number,
): Promise<{ created: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      status: true,
      plan: {
        select: {
          revenueCalculationMode: true,
          perStudentFee: true,
          closingDay: true,
        },
      },
    },
  });

  if (!org || org.status !== "ACTIVE") {
    return { created: false };
  }

  try {
    await prisma.revenueCycle.create({
      data: {
        organizationId: org.id,
        month,
        year,
        revenueCalculationModeUsed: org.plan?.revenueCalculationMode ?? "ON_GENERATED_FEE",
        perStudentFeeUsed: Number(org.plan?.perStudentFee ?? 0),
        closingDayUsed: org.plan?.closingDay ?? 10,
        status: "OPEN",
      },
    });
    return { created: true };
  } catch (error: unknown) {
    const isUnique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isUnique) {
      return { created: false };
    }

    throw error;
  }
}

export async function calculateLiveMetrics(
  organizationId: string,
  month: number,
  year: number,
): Promise<RevenueMetrics> {
  const cycle = await prisma.revenueCycle.findUnique({
    where: { organizationId_month_year: { organizationId, month, year } },
    select: { revenueCalculationModeUsed: true, status: true },
  });

  const mode = cycle?.revenueCalculationModeUsed ?? "ON_GENERATED_FEE";

  const metrics = await computeMetrics(prisma, organizationId, month, year, mode);

  if (cycle && cycle.status === "OPEN") {
    await prisma.revenueCycle.update({
      where: { organizationId_month_year: { organizationId, month, year } },
      data: {
        totalStudents: metrics.totalStudents,
        generatedAmount: metrics.generatedAmount,
        collectedAmount: metrics.collectedAmount,
      },
    });
  }

  return metrics;
}

export async function closeCycle(
  cycleId: string,
  organizationId: string,
): Promise<RevenueCycleSummary> {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.revenueCycle.findUnique({
      where: { id: cycleId },
    });

    if (!cycle || cycle.organizationId !== organizationId) {
      throw new RevenueCycleError("Revenue cycle not found");
    }
    if (cycle.status === "CLOSED") {
      throw new RevenueCycleError("Revenue cycle is already closed");
    }

    const billingSnapshot = await tx.organizationPlan.findUnique({
      where: { organizationId: cycle.organizationId },
      select: {
        revenueCalculationMode: true,
        perStudentFee: true,
        closingDay: true,
      },
    });

    const revenueCalculationModeUsed =
      billingSnapshot?.revenueCalculationMode ?? cycle.revenueCalculationModeUsed;
    const perStudentFeeUsed = Number(billingSnapshot?.perStudentFee ?? cycle.perStudentFeeUsed);
    const closingDayUsed = billingSnapshot?.closingDay ?? cycle.closingDayUsed;

    const metrics = await computeMetrics(
      tx,
      cycle.organizationId,
      cycle.month,
      cycle.year,
      revenueCalculationModeUsed,
    );
    const sairexRevenue = metrics.totalStudents * perStudentFeeUsed;

    const updated = await tx.revenueCycle.update({
      where: { id: cycleId },
      data: {
        revenueCalculationModeUsed,
        perStudentFeeUsed,
        closingDayUsed,
        totalStudents: metrics.totalStudents,
        generatedAmount: metrics.generatedAmount,
        collectedAmount: metrics.collectedAmount,
        sairexRevenue,
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return toSummary(updated);
  });
}

export async function applyAdjustment(input: {
  cycleId: string;
  organizationId: string;
  amount: number;
  reason: string;
  createdBy: string;
}): Promise<RevenueCycleSummary> {
  return prisma.$transaction(async (tx) => {
    const cycle = await tx.revenueCycle.findUnique({
      where: { id: input.cycleId },
    });

    if (!cycle || cycle.organizationId !== input.organizationId) {
      throw new RevenueCycleError("Revenue cycle not found");
    }
    if (cycle.status !== "CLOSED") {
      throw new RevenueCycleError("Adjustments are allowed only on closed cycles");
    }

    await tx.revenueAdjustment.create({
      data: {
        revenueCycleId: cycle.id,
        organizationId: cycle.organizationId,
        amount: input.amount,
        reason: input.reason,
        createdBy: input.createdBy,
      },
    });

    const updated = await tx.revenueCycle.update({
      where: { id: cycle.id },
      data: {
        sairexRevenue: { increment: input.amount },
      },
    });

    return toSummary(updated);
  });
}

export async function listRevenueCycles(
  organizationId: string,
  limit = 24,
): Promise<RevenueCycleSummary[]> {
  const rows = await prisma.revenueCycle.findMany({
    where: { organizationId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map(toSummary);
}

function toSummary(row: {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  revenueCalculationModeUsed: RevenueCalculationMode;
  perStudentFeeUsed: unknown;
  closingDayUsed: number;
  totalStudents: number;
  generatedAmount: unknown;
  collectedAmount: unknown;
  sairexRevenue: unknown;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
}): RevenueCycleSummary {
  return {
    id: row.id,
    organizationId: row.organizationId,
    month: row.month,
    year: row.year,
    revenueCalculationModeUsed: row.revenueCalculationModeUsed,
    perStudentFeeUsed: Number(row.perStudentFeeUsed),
    closingDayUsed: row.closingDayUsed,
    totalStudents: row.totalStudents,
    generatedAmount: Number(row.generatedAmount),
    collectedAmount: Number(row.collectedAmount),
    sairexRevenue: Number(row.sairexRevenue),
    status: row.status,
    closedAt: row.closedAt,
  };
}

export class RevenueCycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevenueCycleError";
  }
}

type DbClient = Pick<typeof prisma, "feeChallan" | "paymentRecord">;

async function computeMetrics(
  db: DbClient,
  organizationId: string,
  month: number,
  year: number,
  mode: RevenueCalculationMode,
): Promise<RevenueMetrics> {
  const { from, to } = monthRangeUtc(month, year);

  const [generatedAggregate, collectedAggregate, generatedStudents, collectedStudents] =
    await Promise.all([
      db.feeChallan.aggregate({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
          issueDate: { gte: from, lt: to },
        },
        _sum: { totalAmount: true },
      }),
      db.paymentRecord.aggregate({
        where: {
          organizationId,
          status: "RECONCILED",
          paidAt: { gte: from, lt: to },
        },
        _sum: { amount: true },
      }),
      db.feeChallan.findMany({
        where: {
          organizationId,
          status: { not: "CANCELLED" },
          issueDate: { gte: from, lt: to },
        },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      db.paymentRecord.findMany({
        where: {
          organizationId,
          status: "RECONCILED",
          paidAt: { gte: from, lt: to },
          challanId: { not: null },
        },
        select: {
          challan: {
            select: { studentId: true },
          },
        },
      }),
    ]);

  const generatedAmount = Number(generatedAggregate._sum.totalAmount ?? 0);
  const collectedAmount = Number(collectedAggregate._sum.amount ?? 0);

  const collectedStudentIds = new Set<number>();
  for (const record of collectedStudents) {
    if (record.challan?.studentId) {
      collectedStudentIds.add(record.challan.studentId);
    }
  }

  const totalStudents =
    mode === "ON_GENERATED_FEE"
      ? generatedStudents.length
      : collectedStudentIds.size;

  return { totalStudents, generatedAmount, collectedAmount };
}

