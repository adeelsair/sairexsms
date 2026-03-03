import { prisma } from "@/lib/prisma";
import type { PlanType, RevenueCalculationMode, RevenueCycleStatus } from "@/lib/generated/prisma";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface OrganizationFinanceDetail {
  summary: {
    organizationName: string;
    planType: PlanType | "UNASSIGNED";
    revenueMode: RevenueCalculationMode | null;
    perStudentFee: number | null;
    closingDay: number | null;
    currentMRR: number | null;
    studentCount: number | null;
    arpu: number | null;
    collectionRate: number | null;
  };
  cycles: Array<{
    id: string;
    month: number;
    year: number;
    students: number;
    revenue: number;
    generated: number;
    collected: number;
    status: RevenueCycleStatus;
  }>;
  adjustments: Array<{
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
    createdBy: string;
  }>;
  recoveryTrend: Array<{
    month: number;
    year: number;
    generated: number;
    collected: number;
  }>;
  risk: {
    level: RiskLevel;
    reasons: string[];
    deltas: {
      revenuePct?: number;
      students?: number;
      collectionRatePct?: number;
    };
  };
}

export async function getOrganizationFinanceDetail(
  organizationId: string,
): Promise<OrganizationFinanceDetail | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      organizationName: true,
      plan: { select: { planType: true } },
    },
  });

  if (!organization) return null;

  const [latestClosedCycle, recentCycles, recentClosedCycles, adjustments] = await Promise.all([
    prisma.revenueCycle.findFirst({
      where: { organizationId, status: "CLOSED" },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        revenueCalculationModeUsed: true,
        perStudentFeeUsed: true,
        closingDayUsed: true,
        totalStudents: true,
        generatedAmount: true,
        collectedAmount: true,
        sairexRevenue: true,
      },
    }),
    prisma.revenueCycle.findMany({
      where: { organizationId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
      select: {
        id: true,
        month: true,
        year: true,
        totalStudents: true,
        sairexRevenue: true,
        generatedAmount: true,
        collectedAmount: true,
        status: true,
      },
    }),
    prisma.revenueCycle.findMany({
      where: { organizationId, status: "CLOSED" },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 2,
      select: {
        totalStudents: true,
        generatedAmount: true,
        collectedAmount: true,
        sairexRevenue: true,
      },
    }),
    prisma.revenueAdjustment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        amount: true,
        reason: true,
        createdAt: true,
        createdBy: true,
      },
    }),
  ]);

  const summary = latestClosedCycle
    ? buildSummaryFromCycle(organization.organizationName, organization.plan?.planType, latestClosedCycle)
    : {
        organizationName: organization.organizationName,
        planType: (organization.plan?.planType ?? "UNASSIGNED") as OrganizationFinanceDetail["summary"]["planType"],
        revenueMode: null,
        perStudentFee: null,
        closingDay: null,
        currentMRR: null,
        studentCount: null,
        arpu: null,
        collectionRate: null,
      };

  const cycles = recentCycles.map((cycle) => ({
    id: cycle.id,
    month: cycle.month,
    year: cycle.year,
    students: cycle.totalStudents,
    revenue: Number(cycle.sairexRevenue),
    generated: Number(cycle.generatedAmount),
    collected: Number(cycle.collectedAmount),
    status: cycle.status,
  }));

  const recoveryTrend = cycles
    .slice()
    .reverse()
    .map((cycle) => ({
      month: cycle.month,
      year: cycle.year,
      generated: cycle.generated,
      collected: cycle.collected,
    }));

  const risk = buildRisk(recentClosedCycles);

  return {
    summary,
    cycles,
    adjustments: adjustments.map((adj) => ({
      id: adj.id,
      amount: Number(adj.amount),
      reason: adj.reason,
      createdAt: adj.createdAt.toISOString(),
      createdBy: adj.createdBy,
    })),
    recoveryTrend,
    risk,
  };
}

function buildSummaryFromCycle(
  organizationName: string,
  planType: PlanType | string | null | undefined,
  cycle: {
    revenueCalculationModeUsed: RevenueCalculationMode;
    perStudentFeeUsed: unknown;
    closingDayUsed: number;
    totalStudents: number;
    generatedAmount: unknown;
    collectedAmount: unknown;
    sairexRevenue: unknown;
  },
): OrganizationFinanceDetail["summary"] {
  const currentMRR = Number(cycle.sairexRevenue);
  const studentCount = cycle.totalStudents;
  const generated = Number(cycle.generatedAmount);
  const collected = Number(cycle.collectedAmount);
  const collectionRate = generated > 0 ? (collected / generated) * 100 : 0;

  return {
    organizationName,
    planType: (planType ?? "UNASSIGNED") as OrganizationFinanceDetail["summary"]["planType"],
    revenueMode: cycle.revenueCalculationModeUsed,
    perStudentFee: Number(cycle.perStudentFeeUsed),
    closingDay: cycle.closingDayUsed,
    currentMRR,
    studentCount,
    arpu: studentCount > 0 ? currentMRR / studentCount : 0,
    collectionRate,
  };
}

function buildRisk(
  closedCycles: Array<{
    totalStudents: number;
    generatedAmount: unknown;
    collectedAmount: unknown;
    sairexRevenue: unknown;
  }>,
): OrganizationFinanceDetail["risk"] {
  const latest = closedCycles[0];
  if (!latest) {
    return {
      level: "LOW",
      reasons: ["Revenue cycle not closed yet"],
      deltas: {},
    };
  }

  const reasons: string[] = [];
  let level: RiskLevel = "LOW";
  const deltas: OrganizationFinanceDetail["risk"]["deltas"] = {};

  const latestCollectionRate = collectionRate(latest);
  if (latestCollectionRate < 60) {
    level = "HIGH";
    reasons.push("Collection dropped below 60%");
  }

  const previous = closedCycles[1];
  if (previous) {
    const latestRevenue = Number(latest.sairexRevenue);
    const previousRevenue = Number(previous.sairexRevenue);
    const revenueChange = percentChange(previousRevenue, latestRevenue);
    if (revenueChange <= -15) {
      level = "HIGH";
      reasons.push("MRR decreased significantly");
    }

    const studentChangePct = percentChange(previous.totalStudents, latest.totalStudents);
    if (studentChangePct <= -10) {
      if (level !== "HIGH") level = "MEDIUM";
      reasons.push("Student count declined");
    }

    const previousCollectionRate = collectionRate(previous);
    if (latestCollectionRate < previousCollectionRate) {
      reasons.push("Collection efficiency declined month-over-month");
    }

    deltas.revenuePct = previousRevenue > 0 ? revenueChange : undefined;
    deltas.students = latest.totalStudents - previous.totalStudents;
    deltas.collectionRatePct = latestCollectionRate - previousCollectionRate;
  }

  if (reasons.length === 0) {
    reasons.push("No significant risk signal in recent closed cycles");
  }

  return { level, reasons, deltas };
}

function collectionRate(cycle: { generatedAmount: unknown; collectedAmount: unknown }): number {
  const generated = Number(cycle.generatedAmount);
  if (generated <= 0) return 0;
  return (Number(cycle.collectedAmount) / generated) * 100;
}

function percentChange(previous: number, current: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
