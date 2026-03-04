import { prisma } from "@/lib/prisma";

type RiskTrend = "IMPROVING" | "WORSENING" | "STABLE";

type OperationalRiskBreakdown = {
  fee: number;
  attendance: number;
  approvals: number;
  expenses: number;
};

export type OperationalRiskResult = {
  score: number;
  trend: RiskTrend;
  breakdown: OperationalRiskBreakdown;
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreByThreshold(input: {
  value: number;
  thresholds: Array<{ max: number; score: number }>;
  fallback: number;
}) {
  for (const threshold of input.thresholds) {
    if (input.value <= threshold.max) {
      return threshold.score;
    }
  }
  return input.fallback;
}

async function calculateFeeRisk(organizationId: string): Promise<number> {
  const now = new Date();
  const rows = await prisma.feeChallan.findMany({
    where: {
      organizationId,
      status: { in: ["UNPAID", "PARTIALLY_PAID", "PAID"] },
    },
    select: {
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
    },
  });

  let totalDue = 0;
  let overdueAmount = 0;
  for (const row of rows) {
    const totalAmount = Number(row.totalAmount);
    const outstanding = Math.max(totalAmount - Number(row.paidAmount), 0);
    totalDue += totalAmount;
    if (row.dueDate < now) {
      overdueAmount += outstanding;
    }
  }

  if (totalDue <= 0) {
    return 90;
  }

  const overduePercent = overdueAmount / totalDue;
  if (overduePercent > 0.4) return 30;
  if (overduePercent > 0.25) return 50;
  if (overduePercent > 0.1) return 70;
  return 90;
}

async function calculateAttendanceRisk(organizationId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const grouped = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      organizationId,
      date: { gte: sevenDaysAgo },
    },
    _count: true,
  });

  if (!grouped.length) {
    return 75;
  }

  let total = 0;
  let stable = 0;
  for (const row of grouped) {
    total += row._count;
    if (row.status === "PRESENT" || row.status === "LATE") {
      stable += row._count;
    }
  }

  const stableRatio = total > 0 ? stable / total : 0;
  return clampScore(stableRatio * 100);
}

async function calculateApprovalRisk(organizationId: string): Promise<number> {
  const pendingApprovals = await prisma.job.count({
    where: {
      organizationId,
      status: { in: ["PENDING", "PROCESSING", "RETRYING"] },
      type: {
        in: ["RECONCILE_PAYMENT", "MONTHLY_POSTING", "PROMOTION_RUN", "REPORT"],
      },
    },
  });

  return scoreByThreshold({
    value: pendingApprovals,
    thresholds: [
      { max: 2, score: 90 },
      { max: 5, score: 75 },
      { max: 10, score: 55 },
    ],
    fallback: 35,
  });
}

async function calculateExpenseRisk(organizationId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      organizationId,
      entryDate: { gte: thirtyDaysAgo },
      entryType: { in: ["ADJUSTMENT", "REFUND", "WAIVER", "PAYMENT_RECEIVED"] },
    },
    select: {
      direction: true,
      entryType: true,
      amount: true,
    },
  });

  let credit = 0;
  let debit = 0;
  let anomalyCount = 0;
  for (const row of rows) {
    const amount = Number(row.amount);
    if (row.direction === "CREDIT") {
      credit += amount;
    } else {
      debit += amount;
    }
    if (row.entryType === "ADJUSTMENT" || row.entryType === "REFUND" || row.entryType === "WAIVER") {
      anomalyCount += 1;
    }
  }

  const debitRatio = debit / Math.max(credit, 1);
  const baseScore = scoreByThreshold({
    value: debitRatio,
    thresholds: [
      { max: 0.1, score: 90 },
      { max: 0.25, score: 75 },
      { max: 0.4, score: 55 },
    ],
    fallback: 35,
  });

  const anomalyPenalty = anomalyCount >= 20 ? 20 : anomalyCount >= 8 ? 10 : 0;
  return clampScore(baseScore - anomalyPenalty);
}

export async function calculateOperationalRisk(
  organizationId: string,
): Promise<{ score: number; breakdown: OperationalRiskBreakdown }> {
  const [fee, attendance, approvals, expenses] = await Promise.all([
    calculateFeeRisk(organizationId),
    calculateAttendanceRisk(organizationId),
    calculateApprovalRisk(organizationId),
    calculateExpenseRisk(organizationId),
  ]);

  const totalScore =
    fee * 0.4 + attendance * 0.25 + approvals * 0.2 + expenses * 0.15;

  return {
    score: clampScore(totalScore),
    breakdown: {
      fee,
      attendance,
      approvals,
      expenses,
    },
  };
}

function computeTrend(todayScore: number, previousScore: number | null): RiskTrend {
  if (previousScore == null) {
    return "STABLE";
  }
  if (todayScore > previousScore) return "IMPROVING";
  if (todayScore < previousScore) return "WORSENING";
  return "STABLE";
}

export async function upsertDailyOperationalRiskSnapshot(
  organizationId: string,
): Promise<{ score: number }> {
  const { score } = await calculateOperationalRisk(organizationId);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.operationalRiskSnapshot.findFirst({
    where: {
      organizationId,
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.operationalRiskSnapshot.update({
      where: { id: existing.id },
      data: { score },
    });
  } else {
    await prisma.operationalRiskSnapshot.create({
      data: {
        organizationId,
        score,
      },
    });
  }

  return { score };
}

export async function getOperationalRiskInsight(
  organizationId: string,
): Promise<OperationalRiskResult> {
  const [{ score, breakdown }, latestSnapshots] = await Promise.all([
    calculateOperationalRisk(organizationId),
    prisma.operationalRiskSnapshot.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { score: true },
    }),
  ]);

  const previousScore =
    latestSnapshots.length > 1 ? latestSnapshots[1].score : latestSnapshots[0]?.score ?? null;

  return {
    score,
    trend: computeTrend(score, previousScore),
    breakdown,
  };
}

export async function runOperationalRiskSnapshotCron(organizationId?: string) {
  if (organizationId) {
    const result = await upsertDailyOperationalRiskSnapshot(organizationId);
    return { processed: 1, scores: [{ organizationId, score: result.score }] };
  }

  const organizations = await prisma.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const scores: Array<{ organizationId: string; score: number }> = [];
  for (const org of organizations) {
    const result = await upsertDailyOperationalRiskSnapshot(org.id);
    scores.push({ organizationId: org.id, score: result.score });
  }

  return { processed: organizations.length, scores };
}
