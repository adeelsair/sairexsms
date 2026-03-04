import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import type { AgingBucket } from "./student-ledger.service";

/* ── Types ──────────────────────────────────────────────── */

export interface FinanceScope {
  organizationId: string;
  unitPath?: string | null;
  campusId?: number;
}

export type RiskLevel = "HEALTHY" | "MODERATE" | "HIGH" | "CRITICAL";

export interface CampusAgingRow {
  campusId: number;
  campusName: string;
  fullUnitPath: string;
  totalStudents: number;
  defaulterCount: number;
  aging: AgingBucket;
  riskLevel: RiskLevel;
}

export interface DashboardMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  totalCurrent: number;
  defaulterStudents: number;
  totalStudents: number;
  aging: AgingBucket;
  riskLevel: RiskLevel;
  collectionRate: number;
}

export interface CollectionMetrics {
  totalPosted: number;
  totalCollected: number;
  collectionRate: number;
  month: number;
  year: number;
}

export interface DefaulterListParams {
  scope: FinanceScope;
  bucket?: "D30" | "D60" | "D90" | "D90_PLUS";
  minAmount?: number;
  sortBy?: "balance" | "overdueDays" | "name";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface DefaulterRow {
  studentId: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  campusId: number;
  campusName: string;
  balance: number;
  totalOutstanding: number;
  oldestOverdueDays: number;
  overdueChallans: number;
  aging: AgingBucket;
}

/* ── Helpers ────────────────────────────────────────────── */

const DAY_MS = 1000 * 60 * 60 * 24;

function classifyBucket(daysOverdue: number): keyof Omit<AgingBucket, "total"> {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "days30";
  if (daysOverdue <= 60) return "days60";
  if (daysOverdue <= 90) return "days90";
  return "over90";
}

function emptyBucket(): AgingBucket {
  return { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
}

function assessRisk(aging: AgingBucket): RiskLevel {
  if (aging.total === 0) return "HEALTHY";
  const criticalRatio = aging.over90 / aging.total;
  const highRatio = (aging.days60 + aging.days90 + aging.over90) / aging.total;
  if (criticalRatio > 0.3) return "CRITICAL";
  if (highRatio > 0.25) return "HIGH";
  if (aging.days30 + aging.days60 + aging.days90 + aging.over90 > 0) return "MODERATE";
  return "HEALTHY";
}

function buildChallanScope(scope: FinanceScope): Prisma.FeeChallanWhereInput {
  const where: Prisma.FeeChallanWhereInput = {
    organizationId: scope.organizationId,
    status: { in: ["UNPAID", "PARTIALLY_PAID"] },
  };
  if (scope.campusId) {
    where.campusId = scope.campusId;
  } else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }
  return where;
}

function bucketCutoff(bucket: string): number {
  switch (bucket) {
    case "D30": return 1;
    case "D60": return 31;
    case "D90": return 61;
    case "D90_PLUS": return 91;
    default: return 1;
  }
}

/* ── Dashboard Metrics ──────────────────────────────────── */

export async function getDashboardMetrics(scope: FinanceScope): Promise<DashboardMetrics> {
  const now = new Date();
  const challanWhere = buildChallanScope(scope);

  const campusFilter: Prisma.StudentWhereInput = {};
  if (scope.campusId) {
    campusFilter.campusId = scope.campusId;
  } else if (scope.unitPath) {
    campusFilter.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  const [challans, totalStudentsResult] = await Promise.all([
    prisma.feeChallan.findMany({
      where: challanWhere,
      select: { studentId: true, totalAmount: true, paidAmount: true, dueDate: true },
    }),
    prisma.student.count({
      where: { organizationId: scope.organizationId, ...campusFilter },
    }),
  ]);

  const aging = emptyBucket();
  const defaulterIds = new Set<number>();

  for (const c of challans) {
    const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
    if (outstanding <= 0) continue;

    const daysOverdue = Math.floor((now.getTime() - c.dueDate.getTime()) / DAY_MS);
    const key = classifyBucket(daysOverdue);
    aging[key] += outstanding;
    aging.total += outstanding;

    if (daysOverdue > 0) {
      defaulterIds.add(c.studentId);
    }
  }

  const overdue = aging.days30 + aging.days60 + aging.days90 + aging.over90;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const collection = await computeCollectionForPeriod(scope, currentMonth, currentYear);

  return {
    totalOutstanding: aging.total,
    totalOverdue: overdue,
    totalCurrent: aging.current,
    defaulterStudents: defaulterIds.size,
    totalStudents: totalStudentsResult,
    aging,
    riskLevel: assessRisk(aging),
    collectionRate: collection.collectionRate,
  };
}

/* ── Campus-Level Aging Breakdown ───────────────────────── */

export async function getCampusAgingSummary(scope: FinanceScope): Promise<CampusAgingRow[]> {
  const now = new Date();
  const challanWhere = buildChallanScope(scope);

  const [challans, campuses] = await Promise.all([
    prisma.feeChallan.findMany({
      where: challanWhere,
      select: { campusId: true, studentId: true, totalAmount: true, paidAmount: true, dueDate: true },
    }),
    prisma.campus.findMany({
      where: scope.unitPath
        ? { organizationId: scope.organizationId, fullUnitPath: { startsWith: scope.unitPath } }
        : { organizationId: scope.organizationId },
      select: { id: true, name: true, fullUnitPath: true },
    }),
  ]);

  const studentCountByCampus = await prisma.student.groupBy({
    by: ["campusId"],
    where: { organizationId: scope.organizationId },
    _count: { id: true },
  });
  const studentCountMap = new Map(studentCountByCampus.map((r) => [r.campusId, r._count.id]));

  const campusAging = new Map<number, { aging: AgingBucket; defaulters: Set<number> }>();

  for (const c of challans) {
    const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
    if (outstanding <= 0) continue;

    if (!campusAging.has(c.campusId)) {
      campusAging.set(c.campusId, { aging: emptyBucket(), defaulters: new Set() });
    }
    const entry = campusAging.get(c.campusId)!;

    const daysOverdue = Math.floor((now.getTime() - c.dueDate.getTime()) / DAY_MS);
    const key = classifyBucket(daysOverdue);
    entry.aging[key] += outstanding;
    entry.aging.total += outstanding;

    if (daysOverdue > 0) {
      entry.defaulters.add(c.studentId);
    }
  }

  const campusMap = new Map(campuses.map((c) => [c.id, c]));
  const rows: CampusAgingRow[] = [];

  for (const [campusId, data] of campusAging) {
    const campus = campusMap.get(campusId);
    if (!campus) continue;

    rows.push({
      campusId,
      campusName: campus.name,
      fullUnitPath: campus.fullUnitPath,
      totalStudents: studentCountMap.get(campusId) ?? 0,
      defaulterCount: data.defaulters.size,
      aging: data.aging,
      riskLevel: assessRisk(data.aging),
    });
  }

  rows.sort((a, b) => b.aging.total - a.aging.total);
  return rows;
}

/* ── Defaulter List (filterable, paginated) ─────────────── */

export async function getDefaulterList(params: DefaulterListParams): Promise<{
  defaulters: DefaulterRow[];
  total: number;
}> {
  const { scope, bucket, minAmount = 0, sortBy = "balance", sortDir = "desc", limit = 50, offset = 0 } = params;
  const now = new Date();

  const challanWhere = buildChallanScope(scope);

  if (bucket) {
    const minDays = bucketCutoff(bucket);
    const cutoff = new Date(now.getTime() - minDays * DAY_MS);
    challanWhere.dueDate = { lt: cutoff };
  } else {
    challanWhere.dueDate = { lt: now };
  }

  const challans = await prisma.feeChallan.findMany({
    where: challanWhere,
    select: { studentId: true, campusId: true, totalAmount: true, paidAmount: true, dueDate: true },
  });

  const studentAging = new Map<number, { aging: AgingBucket; campusId: number; oldestDue: Date }>();

  for (const c of challans) {
    const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
    if (outstanding <= 0) continue;

    if (!studentAging.has(c.studentId)) {
      studentAging.set(c.studentId, { aging: emptyBucket(), campusId: c.campusId, oldestDue: c.dueDate });
    }
    const entry = studentAging.get(c.studentId)!;

    const daysOverdue = Math.floor((now.getTime() - c.dueDate.getTime()) / DAY_MS);
    const key = classifyBucket(daysOverdue);
    entry.aging[key] += outstanding;
    entry.aging.total += outstanding;

    if (c.dueDate < entry.oldestDue) entry.oldestDue = c.dueDate;
  }

  const qualifiedIds: number[] = [];
  for (const [sid, data] of studentAging) {
    if (data.aging.total >= minAmount && data.aging.total > 0) {
      qualifiedIds.push(sid);
    }
  }

  const total = qualifiedIds.length;
  if (total === 0) return { defaulters: [], total: 0 };

  const [students, summaries, campuses] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: qualifiedIds } },
      select: { id: true, fullName: true, admissionNo: true, grade: true, campusId: true },
    }),
    prisma.studentFinancialSummary.findMany({
      where: { studentId: { in: qualifiedIds } },
      select: { studentId: true, balance: true },
    }),
    prisma.campus.findMany({
      where: { organizationId: scope.organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const summaryMap = new Map(summaries.map((s) => [s.studentId, Number(s.balance)]));
  const campusNameMap = new Map(campuses.map((c) => [c.id, c.name]));

  let rows: DefaulterRow[] = [];

  for (const sid of qualifiedIds) {
    const student = studentMap.get(sid);
    const agingData = studentAging.get(sid);
    if (!student || !agingData) continue;

    const balance = summaryMap.get(sid) ?? 0;
    if (balance <= 0) continue;

    const oldestOverdueDays = Math.floor((now.getTime() - agingData.oldestDue.getTime()) / DAY_MS);
    const overdueBucketCount =
      (agingData.aging.days30 > 0 ? 1 : 0) +
      (agingData.aging.days60 > 0 ? 1 : 0) +
      (agingData.aging.days90 > 0 ? 1 : 0) +
      (agingData.aging.over90 > 0 ? 1 : 0);

    rows.push({
      studentId: student.id,
      fullName: student.fullName,
      admissionNo: student.admissionNo,
      grade: student.grade,
      campusId: student.campusId,
      campusName: campusNameMap.get(student.campusId) ?? "",
      balance,
      totalOutstanding: agingData.aging.total,
      oldestOverdueDays,
      overdueChallans: overdueBucketCount,
      aging: agingData.aging,
    });
  }

  rows.sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortBy) {
      case "balance": return (a.balance - b.balance) * dir;
      case "overdueDays": return (a.oldestOverdueDays - b.oldestOverdueDays) * dir;
      case "name": return a.fullName.localeCompare(b.fullName) * dir;
      default: return 0;
    }
  });

  const paged = rows.slice(offset, offset + limit);

  return { defaulters: paged, total };
}

/* ── Collection Efficiency ──────────────────────────────── */

export async function computeCollectionForPeriod(
  scope: FinanceScope,
  month: number,
  year: number,
): Promise<CollectionMetrics> {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const ledgerWhere: Prisma.LedgerEntryWhereInput = {
    organizationId: scope.organizationId,
    entryDate: { gte: periodStart, lte: periodEnd },
  };
  if (scope.campusId) ledgerWhere.campusId = scope.campusId;
  if (scope.unitPath && !scope.campusId) {
    ledgerWhere.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  const totals = await prisma.ledgerEntry.groupBy({
    by: ["direction"],
    where: ledgerWhere,
    _sum: { amount: true },
  });

  let totalPosted = 0;
  let totalCollected = 0;

  for (const row of totals) {
    const sum = Number(row._sum.amount ?? 0);
    if (row.direction === "DEBIT") totalPosted = sum;
    if (row.direction === "CREDIT") totalCollected = sum;
  }

  const collectionRate = totalPosted > 0 ? (totalCollected / totalPosted) * 100 : 0;

  return { totalPosted, totalCollected, collectionRate, month, year };
}

/* ── Collection Trend (multiple months) ─────────────────── */

export async function getCollectionTrend(
  scope: FinanceScope,
  months: number = 6,
): Promise<CollectionMetrics[]> {
  const now = new Date();
  const results: CollectionMetrics[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    results.push(await computeCollectionForPeriod(scope, m, y));
  }

  return results;
}
