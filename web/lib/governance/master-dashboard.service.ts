/**
 * Master Dashboard Service — Chain-Wide KPIs + Campus Comparison
 *
 * Provides the data layer for the Head Office Control Panel.
 * Uses groupBy + in-memory mapping for O(1) query set per metric.
 * All queries respect organizationId for tenant isolation.
 */
import { prisma } from "@/lib/prisma";

/* ── Types ────────────────────────────────────────────── */

interface ChainKpis {
  totalCampuses: number;
  totalStudents: number;
  totalCollection: number;
  totalOutstanding: number;
  collectionEfficiency: number;
  averageAttendance: number;
  digitalPaymentRatio: number;
}

interface CampusComparison {
  campusId: number;
  campusName: string;
  fullUnitPath: string;
  studentCount: number;
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;
  outstandingAmount: number;
  attendanceRate: number;
  healthScore: number;
  riskLevel: string;
  isFinancialLocked: boolean;
  isAcademicLocked: boolean;
}

interface LeakageAlert {
  campusId: number;
  campusName: string;
  type: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

/* ── Chain KPIs ───────────────────────────────────────── */

export async function getChainKpis(organizationId: string): Promise<ChainKpis> {
  const [campusCount, studentCount, financials, attendanceStats, digitalStats] =
    await Promise.all([
      prisma.campus.count({
        where: { organizationId, status: "ACTIVE" },
      }),

      prisma.student.count({
        where: { organizationId },
      }),

      prisma.feeChallan.aggregate({
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true },
      }),

      computeOrgAttendanceRate(organizationId),

      prisma.paymentRecord.groupBy({
        by: ["gateway"],
        where: { organizationId, status: "RECONCILED" },
        _sum: { amount: true },
      }),
    ]);

  const totalBilled = Number(financials._sum.totalAmount ?? 0);
  const totalCollected = Number(financials._sum.paidAmount ?? 0);

  let digitalTotal = 0;
  let manualTotal = 0;
  for (const row of digitalStats) {
    const amt = Number(row._sum.amount ?? 0);
    if (row.gateway === "MANUAL") {
      manualTotal += amt;
    } else {
      digitalTotal += amt;
    }
  }
  const totalPayments = digitalTotal + manualTotal;

  return {
    totalCampuses: campusCount,
    totalStudents: studentCount,
    totalCollection: totalCollected,
    totalOutstanding: Math.max(0, totalBilled - totalCollected),
    collectionEfficiency:
      totalBilled > 0
        ? Math.round((totalCollected / totalBilled) * 10000) / 100
        : 0,
    averageAttendance: attendanceStats,
    digitalPaymentRatio:
      totalPayments > 0
        ? Math.round((digitalTotal / totalPayments) * 10000) / 100
        : 0,
  };
}

async function computeOrgAttendanceRate(
  organizationId: string,
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const counts = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      organizationId,
      date: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  let total = 0;
  let present = 0;
  for (const row of counts) {
    total += row._count;
    if (row.status === "PRESENT" || row.status === "LATE") {
      present += row._count;
    }
  }

  return total > 0 ? Math.round((present / total) * 10000) / 100 : 0;
}

/* ── Campus Comparison Table ──────────────────────────── */

export async function getCampusComparison(
  organizationId: string,
): Promise<CampusComparison[]> {
  const [campuses, challanStats, healthScores, lockStatuses, enrollmentCounts] =
    await Promise.all([
      prisma.campus.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, name: true, fullUnitPath: true },
        orderBy: { name: "asc" },
      }),

      prisma.feeChallan.groupBy({
        by: ["campusId"],
        where: { organizationId, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true },
      }),

      prisma.campusHealthScore.findMany({
        where: { organizationId },
      }),

      prisma.campusOperationalStatus.findMany(),

      prisma.student.groupBy({
        by: ["campusId"],
        where: { organizationId },
        _count: true,
      }),
    ]);

  const challanMap = new Map<number, { billed: number; collected: number }>();
  for (const row of challanStats) {
    challanMap.set(row.campusId, {
      billed: Number(row._sum.totalAmount ?? 0),
      collected: Number(row._sum.paidAmount ?? 0),
    });
  }

  const healthMap = new Map<
    number,
    { score: number; risk: string; attendance: number }
  >();
  for (const h of healthScores) {
    healthMap.set(h.campusId, {
      score: Number(h.compositeScore),
      risk: h.riskLevel,
      attendance: Number(h.attendanceRate),
    });
  }

  const lockMap = new Map<number, { financial: boolean; academic: boolean }>();
  for (const l of lockStatuses) {
    lockMap.set(l.campusId, {
      financial: l.isFinancialLocked,
      academic: l.isAcademicLocked,
    });
  }

  const studentMap = new Map<number, number>();
  for (const row of enrollmentCounts) {
    studentMap.set(row.campusId, row._count);
  }

  return campuses.map((campus) => {
    const fin = challanMap.get(campus.id) ?? { billed: 0, collected: 0 };
    const health = healthMap.get(campus.id) ?? {
      score: 0,
      risk: "LOW",
      attendance: 0,
    };
    const lock = lockMap.get(campus.id) ?? {
      financial: false,
      academic: false,
    };

    return {
      campusId: campus.id,
      campusName: campus.name,
      fullUnitPath: campus.fullUnitPath,
      studentCount: studentMap.get(campus.id) ?? 0,
      totalBilled: fin.billed,
      totalCollected: fin.collected,
      collectionRate:
        fin.billed > 0
          ? Math.round((fin.collected / fin.billed) * 10000) / 100
          : 0,
      outstandingAmount: Math.max(0, fin.billed - fin.collected),
      attendanceRate: health.attendance,
      healthScore: health.score,
      riskLevel: health.risk,
      isFinancialLocked: lock.financial,
      isAcademicLocked: lock.academic,
    };
  });
}

/* ── Leakage Detection ────────────────────────────────── */

export async function detectLeakageAlerts(
  organizationId: string,
): Promise<LeakageAlert[]> {
  const alerts: LeakageAlert[] = [];

  const campuses = await prisma.campus.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const campusMap = new Map<number, string>();
  for (const c of campuses) campusMap.set(c.id, c.name);

  const challanStats = await prisma.feeChallan.groupBy({
    by: ["campusId"],
    where: { organizationId, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true, paidAmount: true },
  });

  for (const row of challanStats) {
    const billed = Number(row._sum.totalAmount ?? 0);
    const collected = Number(row._sum.paidAmount ?? 0);

    if (billed > 0) {
      const rate = collected / billed;

      if (rate < 0.3) {
        alerts.push({
          campusId: row.campusId,
          campusName: campusMap.get(row.campusId) ?? `Campus ${row.campusId}`,
          type: "LOW_COLLECTION",
          description: `Collection rate is only ${Math.round(rate * 100)}%`,
          severity: "HIGH",
        });
      } else if (rate < 0.5) {
        alerts.push({
          campusId: row.campusId,
          campusName: campusMap.get(row.campusId) ?? `Campus ${row.campusId}`,
          type: "LOW_COLLECTION",
          description: `Collection rate is ${Math.round(rate * 100)}%`,
          severity: "MEDIUM",
        });
      }
    }
  }

  const unreconciledCounts = await prisma.paymentRecord.groupBy({
    by: ["organizationId"],
    where: { organizationId, status: "PENDING" },
    _count: true,
  });

  if (unreconciledCounts.length > 0 && unreconciledCounts[0]._count > 10) {
    alerts.push({
      campusId: 0,
      campusName: "Organization-wide",
      type: "UNRECONCILED_PAYMENTS",
      description: `${unreconciledCounts[0]._count} payments pending reconciliation`,
      severity: unreconciledCounts[0]._count > 50 ? "HIGH" : "MEDIUM",
    });
  }

  return alerts;
}
