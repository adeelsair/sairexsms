import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import type { PlanType, RevenueCalculationMode, RevenueCycleStatus } from "@/lib/generated/prisma";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type AlertSeverity = "info" | "warning";

export interface FinanceDashboardFilters {
  month?: number;
  year?: number;
  revenueMode?: RevenueCalculationMode | "ALL";
  planType?: PlanType | "ALL";
}

export interface FinanceDashboardKpis {
  mrrClosed: number;
  projectedMrr: number;
  collectedAmount: number;
  generatedAmount: number;
  collectionRate: number;
  collectionEfficiency: number;
  activePayingStudents: number;
  arpuPerStudent: number;
  overdueCycles: number;
  atRiskMrr: number;
  momChange: {
    mrrPercent: number;
    studentsPercent: number;
    arpuPercent: number;
  };
}

export interface FinanceTrendPoint {
  month: number;
  year: number;
  label: string;
  mrr: number;
  collectedAmount: number;
}

export interface OrganizationRevenueRow {
  organizationId: string;
  organizationName: string;
  students: number;
  mode: RevenueCalculationMode;
  planType: PlanType | "UNASSIGNED";
  revenue: number;
  collectedPercent: number;
  status: RevenueCycleStatus | "OVERDUE";
  risk: RiskLevel;
  riskTrend: "IMPROVING" | "WORSENING" | "STABLE";
}

export interface AutomationHealth {
  lastCronActivityAt: string | null;
  failedOrganizationsLast24h: number;
  autoClosedEventsLast24h: number;
  lockSkipsLast24h: number;
}

export interface FinanceAlert {
  severity: AlertSeverity;
  message: string;
}

export interface FinanceDashboardResponse {
  period: { month: number; year: number };
  kpis: FinanceDashboardKpis;
  trend: FinanceTrendPoint[];
  organizationTable: OrganizationRevenueRow[];
  modeDistribution: {
    onGeneratedFeeOrganizations: number;
    onCollectedFeeOrganizations: number;
  };
  automationHealth: AutomationHealth;
  alerts: FinanceAlert[];
}

export async function getFinanceDashboardData(
  input: FinanceDashboardFilters,
): Promise<FinanceDashboardResponse> {
  const period = await resolvePeriod(input.month, input.year);

  const cycleWhere = {
    month: period.month,
    year: period.year,
    ...(input.revenueMode && input.revenueMode !== "ALL"
      ? { revenueCalculationModeUsed: input.revenueMode }
      : {}),
    ...(input.planType && input.planType !== "ALL"
      ? { organization: { plan: { is: { planType: input.planType } } } }
      : {}),
  };

  const periodCycles = await prisma.revenueCycle.findMany({
    where: cycleWhere,
    select: {
      organizationId: true,
      status: true,
      revenueCalculationModeUsed: true,
      perStudentFeeUsed: true,
      closingDayUsed: true,
      totalStudents: true,
      generatedAmount: true,
      collectedAmount: true,
      sairexRevenue: true,
      organization: {
        select: {
          organizationName: true,
          timezone: true,
          plan: {
            select: {
              planType: true,
            },
          },
        },
      },
    },
  });

  const previous = previousPeriod(period.month, period.year);
  const twoBack = previousPeriod(previous.month, previous.year);
  const previousCycles = await prisma.revenueCycle.findMany({
    where: {
      organizationId: { in: periodCycles.map((cycle) => cycle.organizationId) },
      month: previous.month,
      year: previous.year,
    },
    select: {
      organizationId: true,
      totalStudents: true,
      sairexRevenue: true,
    },
  });
  const previousAndTwoBackCycles = await prisma.revenueCycle.findMany({
    where: {
      organizationId: { in: periodCycles.map((cycle) => cycle.organizationId) },
      OR: [
        { month: previous.month, year: previous.year },
        { month: twoBack.month, year: twoBack.year },
      ],
    },
    select: {
      organizationId: true,
      month: true,
      year: true,
      totalStudents: true,
      generatedAmount: true,
      collectedAmount: true,
      sairexRevenue: true,
    },
  });
  const previousPeriodClosedCycles = await prisma.revenueCycle.findMany({
    where: {
      month: previous.month,
      year: previous.year,
      status: "CLOSED",
      ...(input.revenueMode && input.revenueMode !== "ALL"
        ? { revenueCalculationModeUsed: input.revenueMode }
        : {}),
      ...(input.planType && input.planType !== "ALL"
        ? { organization: { plan: { is: { planType: input.planType } } } }
        : {}),
    },
    select: {
      totalStudents: true,
      sairexRevenue: true,
    },
  });
  const previousByOrg = new Map(previousCycles.map((cycle) => [cycle.organizationId, cycle]));
  const previousPeriodByOrg = new Map(
    previousAndTwoBackCycles
      .filter((cycle) => cycle.month === previous.month && cycle.year === previous.year)
      .map((cycle) => [cycle.organizationId, cycle]),
  );
  const twoBackByOrg = new Map(
    previousAndTwoBackCycles
      .filter((cycle) => cycle.month === twoBack.month && cycle.year === twoBack.year)
      .map((cycle) => [cycle.organizationId, cycle]),
  );

  const closedCycles = periodCycles.filter((cycle) => cycle.status === "CLOSED");
  const openCycles = periodCycles.filter((cycle) => cycle.status === "OPEN");

  const overdueCycles = periodCycles.filter((cycle) => {
    if (cycle.status !== "OPEN") return false;
    const orgNow = DateTime.utc().setZone(cycle.organization.timezone || "Asia/Karachi");
    return orgNow.day > cycle.closingDayUsed;
  }).length;

  const organizationTable = buildOrganizationRows(
    periodCycles,
    previousByOrg,
    previousPeriodByOrg,
    twoBackByOrg,
  );
  const atRiskMrr = sum(
    organizationTable
      .filter((row) => row.risk === "HIGH")
      .map((row) => row.revenue),
  );
  const kpis = computeKpis(
    closedCycles,
    openCycles,
    previousPeriodClosedCycles,
    overdueCycles,
    atRiskMrr,
  );
  const trend = await getTrend();
  const modeDistribution = getModeDistribution(periodCycles);
  const automationHealth = await getAutomationHealth();
  const alerts = buildAlerts(organizationTable, previousByOrg);

  return {
    period,
    kpis,
    trend,
    organizationTable,
    modeDistribution,
    automationHealth,
    alerts,
  };
}

async function resolvePeriod(month?: number, year?: number): Promise<{ month: number; year: number }> {
  if (month && year) return { month, year };

  const latestClosed = await prisma.revenueCycle.findFirst({
    where: { status: "CLOSED" },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { month: true, year: true },
  });

  if (latestClosed) {
    return { month: latestClosed.month, year: latestClosed.year };
  }

  const now = DateTime.utc();
  return { month: now.month, year: now.year };
}

function computeKpis(
  closedCycles: Array<{
    totalStudents: number;
    generatedAmount: unknown;
    collectedAmount: unknown;
    sairexRevenue: unknown;
  }>,
  openCycles: Array<{
    totalStudents: number;
    perStudentFeeUsed: unknown;
  }>,
  previousClosedCycles: Array<{
    totalStudents: number;
    sairexRevenue: unknown;
  }>,
  overdueCycles: number,
  atRiskMrr: number,
): FinanceDashboardKpis {
  const mrrClosed = sum(closedCycles.map((cycle) => Number(cycle.sairexRevenue)));
  const collectedAmount = sum(closedCycles.map((cycle) => Number(cycle.collectedAmount)));
  const generatedAmount = sum(closedCycles.map((cycle) => Number(cycle.generatedAmount)));
  const activePayingStudents = sum(closedCycles.map((cycle) => cycle.totalStudents));
  const projectedMrr = sum(
    openCycles.map((cycle) => cycle.totalStudents * Number(cycle.perStudentFeeUsed)),
  );
  const collectionRate = generatedAmount > 0 ? (collectedAmount / generatedAmount) * 100 : 0;
  const collectionEfficiency = collectionRate;
  const arpuPerStudent = activePayingStudents > 0 ? mrrClosed / activePayingStudents : 0;

  const previousMrr = sum(previousClosedCycles.map((cycle) => Number(cycle.sairexRevenue)));
  const previousStudents = sum(previousClosedCycles.map((cycle) => cycle.totalStudents));
  const previousArpu = previousStudents > 0 ? previousMrr / previousStudents : 0;

  const momChange = {
    mrrPercent: percentChange(previousMrr, mrrClosed),
    studentsPercent: percentChange(previousStudents, activePayingStudents),
    arpuPercent: percentChange(previousArpu, arpuPerStudent),
  };

  return {
    mrrClosed,
    projectedMrr,
    collectedAmount,
    generatedAmount,
    collectionRate,
    collectionEfficiency,
    activePayingStudents,
    arpuPerStudent,
    overdueCycles,
    atRiskMrr,
    momChange,
  };
}

function buildOrganizationRows(
  cycles: Array<{
    organizationId: string;
    status: RevenueCycleStatus;
    revenueCalculationModeUsed: RevenueCalculationMode;
    closingDayUsed: number;
    totalStudents: number;
    generatedAmount: unknown;
    collectedAmount: unknown;
    sairexRevenue: unknown;
    organization: {
      organizationName: string;
      timezone: string;
      plan: { planType: PlanType } | null;
    };
  }>,
  previousByOrg: Map<string, { totalStudents: number; sairexRevenue: unknown }>,
  previousPeriodByOrg: Map<
    string,
    {
      totalStudents: number;
      generatedAmount: unknown;
      collectedAmount: unknown;
      sairexRevenue: unknown;
    }
  >,
  twoBackByOrg: Map<
    string,
    {
      totalStudents: number;
      sairexRevenue: unknown;
    }
  >,
): OrganizationRevenueRow[] {
  return cycles
    .map((cycle) => {
      const generatedAmount = Number(cycle.generatedAmount);
      const collectedAmount = Number(cycle.collectedAmount);
      const collectedPercent = generatedAmount > 0 ? (collectedAmount / generatedAmount) * 100 : 0;

      const orgNow = DateTime.utc().setZone(cycle.organization.timezone || "Asia/Karachi");
      const overdue = cycle.status === "OPEN" && orgNow.day > cycle.closingDayUsed;
      const status: OrganizationRevenueRow["status"] = overdue ? "OVERDUE" : cycle.status;

      const previous = previousByOrg.get(cycle.organizationId);
      const studentDrop = previous ? cycle.totalStudents < previous.totalStudents : false;
      const revenueDrop = previous ? Number(cycle.sairexRevenue) < Number(previous.sairexRevenue) : false;
      const risk = computeRisk(collectedPercent, studentDrop, revenueDrop);
      const previousCycle = previousPeriodByOrg.get(cycle.organizationId);
      const twoBackCycle = twoBackByOrg.get(cycle.organizationId);
      const previousRisk = previousCycle
        ? computeRisk(
            percentFromAmounts(
              Number(previousCycle.collectedAmount),
              Number(previousCycle.generatedAmount),
            ),
            twoBackCycle ? previousCycle.totalStudents < twoBackCycle.totalStudents : false,
            twoBackCycle
              ? Number(previousCycle.sairexRevenue) < Number(twoBackCycle.sairexRevenue)
              : false,
          )
        : risk;
      const riskTrend = compareRiskDirection(risk, previousRisk);
      const planType = (cycle.organization.plan?.planType ?? "UNASSIGNED") as OrganizationRevenueRow["planType"];

      return {
        organizationId: cycle.organizationId,
        organizationName: cycle.organization.organizationName,
        students: cycle.totalStudents,
        mode: cycle.revenueCalculationModeUsed,
        planType,
        revenue: Number(cycle.sairexRevenue),
        collectedPercent,
        status,
        risk,
        riskTrend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

async function getTrend(): Promise<FinanceTrendPoint[]> {
  const grouped = await prisma.revenueCycle.groupBy({
    by: ["year", "month"],
    where: { status: "CLOSED" },
    _sum: {
      sairexRevenue: true,
      collectedAmount: true,
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: 12,
  });

  return grouped
    .slice()
    .reverse()
    .map((point) => ({
      month: point.month,
      year: point.year,
      label: `${monthLabel(point.month)} ${point.year}`,
      mrr: Number(point._sum.sairexRevenue ?? 0),
      collectedAmount: Number(point._sum.collectedAmount ?? 0),
    }));
}

function getModeDistribution(
  cycles: Array<{ revenueCalculationModeUsed: RevenueCalculationMode }>,
): FinanceDashboardResponse["modeDistribution"] {
  let onGeneratedFeeOrganizations = 0;
  let onCollectedFeeOrganizations = 0;

  for (const cycle of cycles) {
    if (cycle.revenueCalculationModeUsed === "ON_GENERATED_FEE") {
      onGeneratedFeeOrganizations += 1;
    } else {
      onCollectedFeeOrganizations += 1;
    }
  }

  return { onGeneratedFeeOrganizations, onCollectedFeeOrganizations };
}

async function getAutomationHealth(): Promise<AutomationHealth> {
  const now = DateTime.utc();
  const since = now.minus({ hours: 24 }).toJSDate();

  const [lastEvent, failedEvents, autoClosedEvents] = await Promise.all([
    prisma.domainEventLog.findFirst({
      where: {
        eventType: {
          in: ["RevenueCycleAutoCreated", "RevenueCycleAutoClosed", "RevenueCycleCronFailed"],
        },
      },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
    prisma.domainEventLog.findMany({
      where: {
        eventType: "RevenueCycleCronFailed",
        occurredAt: { gte: since },
      },
      select: { organizationId: true },
    }),
    prisma.domainEventLog.count({
      where: {
        eventType: "RevenueCycleAutoClosed",
        occurredAt: { gte: since },
      },
    }),
  ]);

  const failedOrganizationsLast24h = new Set(failedEvents.map((event) => event.organizationId)).size;

  return {
    lastCronActivityAt: lastEvent?.occurredAt.toISOString() ?? null,
    failedOrganizationsLast24h,
    autoClosedEventsLast24h: autoClosedEvents,
    lockSkipsLast24h: 0,
  };
}

function buildAlerts(
  rows: OrganizationRevenueRow[],
  previousByOrg: Map<string, { totalStudents: number; sairexRevenue: unknown }>,
): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];

  const recoveryLow = rows.filter((row) => row.collectedPercent < 60);
  if (recoveryLow.length > 0) {
    alerts.push({
      severity: "warning",
      message: `${recoveryLow.length} organization(s) are below 60% collection efficiency.`,
    });
  }

  const firstRevenueDrop = rows.find((row) => {
    const previous = previousByOrg.get(row.organizationId);
    return previous ? row.revenue < Number(previous.sairexRevenue) : false;
  });
  if (firstRevenueDrop) {
    alerts.push({
      severity: "warning",
      message: `${firstRevenueDrop.organizationName} shows a month-over-month revenue drop.`,
    });
  }

  const firstHighGrowth = rows.find((row) => {
    const previous = previousByOrg.get(row.organizationId);
    if (!previous) return false;
    const previousRevenue = Number(previous.sairexRevenue);
    if (previousRevenue <= 0) return false;
    return ((row.revenue - previousRevenue) / previousRevenue) * 100 >= 20;
  });
  if (firstHighGrowth) {
    alerts.push({
      severity: "info",
      message: `${firstHighGrowth.organizationName} is growing more than 20% month-over-month.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      severity: "info",
      message: "No critical finance alerts for the selected period.",
    });
  }

  return alerts.slice(0, 5);
}

function previousPeriod(month: number, year: number): { month: number; year: number } {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

function computeRisk(
  collectedPercent: number,
  studentDrop: boolean,
  revenueDrop: boolean,
): RiskLevel {
  if (collectedPercent < 60 || (studentDrop && revenueDrop)) return "HIGH";
  if (collectedPercent < 80 || studentDrop || revenueDrop) return "MEDIUM";
  return "LOW";
}

function monthLabel(month: number): string {
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return labels[month - 1] ?? `M${month}`;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function percentFromAmounts(collected: number, generated: number): number {
  if (generated <= 0) return 0;
  return (collected / generated) * 100;
}

function percentChange(previous: number, current: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

function compareRiskDirection(
  current: RiskLevel,
  previous: RiskLevel,
): "IMPROVING" | "WORSENING" | "STABLE" {
  const rank: Record<RiskLevel, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  };

  if (rank[current] > rank[previous]) return "WORSENING";
  if (rank[current] < rank[previous]) return "IMPROVING";
  return "STABLE";
}
