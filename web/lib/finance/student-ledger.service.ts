import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

/* ── Types ──────────────────────────────────────────────── */

export interface StudentBalance {
  studentId: number;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export interface DefaulterRecord {
  studentId: number;
  fullName: string;
  admissionNo: string;
  grade: string;
  campusId: number;
  balance: number;
  oldestOverdueDays: number;
  overdueChallans: number;
}

export interface LedgerStatement {
  entries: LedgerRow[];
  openingBalance: number;
  closingBalance: number;
}

export interface LedgerRow {
  id: string;
  entryDate: Date;
  entryType: string;
  direction: string;
  amount: number;
  runningBalance: number;
  challanId: number | null;
  referenceId: string | null;
  notes: string | null;
}

/* ── Scope filter type ──────────────────────────────────── */

interface ScopeFilter {
  organizationId: string;
  campusId?: number;
}

/* ── Live Balance (from ledger groupBy) ─────────────────── */

export async function computeStudentBalance(studentId: number): Promise<StudentBalance> {
  const result = await prisma.ledgerEntry.groupBy({
    by: ["direction"],
    where: { studentId },
    _sum: { amount: true },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  for (const row of result) {
    const sum = Number(row._sum.amount ?? 0);
    if (row.direction === "DEBIT") totalDebit = sum;
    if (row.direction === "CREDIT") totalCredit = sum;
  }

  return {
    studentId,
    totalDebit,
    totalCredit,
    balance: totalDebit - totalCredit,
  };
}

/* ── Fast Balance (from materialized summary) ───────────── */

export async function getStudentSummary(studentId: number): Promise<StudentBalance | null> {
  const summary = await prisma.studentFinancialSummary.findUnique({
    where: { studentId },
  });

  if (!summary) return null;

  return {
    studentId: summary.studentId,
    totalDebit: Number(summary.totalDebit),
    totalCredit: Number(summary.totalCredit),
    balance: Number(summary.balance),
  };
}

/* ── Rebuild Summary (repair / migration tool) ──────────── */

export async function refreshStudentSummary(studentId: number): Promise<StudentBalance> {
  const live = await computeStudentBalance(studentId);

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { organizationId: true, campusId: true },
  });

  await prisma.studentFinancialSummary.upsert({
    where: { studentId },
    create: {
      studentId,
      organizationId: student.organizationId,
      campusId: student.campusId,
      totalDebit: live.totalDebit,
      totalCredit: live.totalCredit,
      balance: live.balance,
    },
    update: {
      totalDebit: live.totalDebit,
      totalCredit: live.totalCredit,
      balance: live.balance,
    },
  });

  return live;
}

/* ── Student Ledger Statement ───────────────────────────── */

export async function getStudentStatement(
  studentId: number,
  dateFrom?: Date,
  dateTo?: Date,
): Promise<LedgerStatement> {
  const dateFilter: Prisma.LedgerEntryWhereInput = {};
  if (dateFrom || dateTo) {
    dateFilter.entryDate = {};
    if (dateFrom) dateFilter.entryDate.gte = dateFrom;
    if (dateTo) dateFilter.entryDate.lte = dateTo;
  }

  let openingBalance = 0;
  if (dateFrom) {
    const prior = await prisma.ledgerEntry.groupBy({
      by: ["direction"],
      where: { studentId, entryDate: { lt: dateFrom } },
      _sum: { amount: true },
    });
    let priorDebit = 0;
    let priorCredit = 0;
    for (const row of prior) {
      const sum = Number(row._sum.amount ?? 0);
      if (row.direction === "DEBIT") priorDebit = sum;
      if (row.direction === "CREDIT") priorCredit = sum;
    }
    openingBalance = priorDebit - priorCredit;
  }

  const rawEntries = await prisma.ledgerEntry.findMany({
    where: { studentId, ...dateFilter },
    orderBy: { entryDate: "asc" },
    select: {
      id: true,
      entryDate: true,
      entryType: true,
      direction: true,
      amount: true,
      challanId: true,
      referenceId: true,
      notes: true,
    },
  });

  let running = openingBalance;
  const entries: LedgerRow[] = rawEntries.map((e) => {
    const amt = Number(e.amount);
    running += e.direction === "DEBIT" ? amt : -amt;
    return {
      id: e.id,
      entryDate: e.entryDate,
      entryType: e.entryType,
      direction: e.direction,
      amount: amt,
      runningBalance: running,
      challanId: e.challanId,
      referenceId: e.referenceId,
      notes: e.notes,
    };
  });

  return {
    entries,
    openingBalance,
    closingBalance: running,
  };
}

/* ── Aging Engine ───────────────────────────────────────── */

export async function computeStudentAging(studentId: number): Promise<AgingBucket> {
  const now = new Date();

  const unpaidChallans = await prisma.feeChallan.findMany({
    where: {
      studentId,
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
    },
    select: {
      totalAmount: true,
      paidAmount: true,
      dueDate: true,
    },
  });

  const bucket: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

  for (const c of unpaidChallans) {
    const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
    if (outstanding <= 0) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.days30 += outstanding;
    else if (daysOverdue <= 60) bucket.days60 += outstanding;
    else if (daysOverdue <= 90) bucket.days90 += outstanding;
    else bucket.over90 += outstanding;

    bucket.total += outstanding;
  }

  return bucket;
}

/* ── Bulk Aging (scoped) ────────────────────────────────── */

export async function computeBulkAging(scope: ScopeFilter): Promise<AgingBucket> {
  const now = new Date();

  const where: Prisma.FeeChallanWhereInput = {
    organizationId: scope.organizationId,
    status: { in: ["UNPAID", "PARTIALLY_PAID"] },
  };
  if (scope.campusId) where.campusId = scope.campusId;

  const challans = await prisma.feeChallan.findMany({
    where,
    select: { totalAmount: true, paidAmount: true, dueDate: true },
  });

  const bucket: AgingBucket = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

  for (const c of challans) {
    const outstanding = Number(c.totalAmount) - Number(c.paidAmount);
    if (outstanding <= 0) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysOverdue <= 0) bucket.current += outstanding;
    else if (daysOverdue <= 30) bucket.days30 += outstanding;
    else if (daysOverdue <= 60) bucket.days60 += outstanding;
    else if (daysOverdue <= 90) bucket.days90 += outstanding;
    else bucket.over90 += outstanding;

    bucket.total += outstanding;
  }

  return bucket;
}

/* ── Defaulter Detection ────────────────────────────────── */

export async function getDefaulters(
  scope: ScopeFilter,
  options: { minOverdueDays?: number; limit?: number; offset?: number } = {},
): Promise<{ defaulters: DefaulterRecord[]; total: number }> {
  const { minOverdueDays = 1, limit = 50, offset = 0 } = options;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minOverdueDays);

  const campusFilter: Prisma.FeeChallanWhereInput = scope.campusId
    ? { campusId: scope.campusId }
    : {};

  const overdueStudents = await prisma.feeChallan.groupBy({
    by: ["studentId"],
    where: {
      organizationId: scope.organizationId,
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      dueDate: { lt: cutoffDate },
      ...campusFilter,
    },
    _count: { id: true },
    _min: { dueDate: true },
    orderBy: { _min: { dueDate: "asc" } },
    skip: offset,
    take: limit,
  });

  const totalCount = await prisma.feeChallan.groupBy({
    by: ["studentId"],
    where: {
      organizationId: scope.organizationId,
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      dueDate: { lt: cutoffDate },
      ...campusFilter,
    },
  });

  if (overdueStudents.length === 0) {
    return { defaulters: [], total: 0 };
  }

  const studentIds = overdueStudents.map((r) => r.studentId);

  const [students, summaries] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, fullName: true, admissionNo: true, grade: true, campusId: true },
    }),
    prisma.studentFinancialSummary.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, balance: true },
    }),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const summaryMap = new Map(summaries.map((s) => [s.studentId, Number(s.balance)]));

  const now = new Date();
  const defaulters: DefaulterRecord[] = [];

  for (const row of overdueStudents) {
    const student = studentMap.get(row.studentId);
    if (!student) continue;

    const balance = summaryMap.get(row.studentId) ?? 0;
    if (balance <= 0) continue;

    const oldestDue = row._min.dueDate;
    const oldestOverdueDays = oldestDue
      ? Math.floor((now.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    defaulters.push({
      studentId: student.id,
      fullName: student.fullName,
      admissionNo: student.admissionNo,
      grade: student.grade,
      campusId: student.campusId,
      balance,
      oldestOverdueDays,
      overdueChallans: row._count.id,
    });
  }

  return { defaulters, total: totalCount.length };
}

/* ── Batch Summary Refresh ──────────────────────────────── */

export async function refreshAllSummaries(organizationId: string): Promise<number> {
  const students = await prisma.student.findMany({
    where: { organizationId },
    select: { id: true, campusId: true },
  });

  const ledgerTotals = await prisma.ledgerEntry.groupBy({
    by: ["studentId", "direction"],
    where: { organizationId, studentId: { not: null } },
    _sum: { amount: true },
  });

  const balanceMap = new Map<number, { debit: number; credit: number }>();
  for (const row of ledgerTotals) {
    if (row.studentId == null) continue;
    const entry = balanceMap.get(row.studentId) ?? { debit: 0, credit: 0 };
    const sum = Number(row._sum.amount ?? 0);
    if (row.direction === "DEBIT") entry.debit = sum;
    if (row.direction === "CREDIT") entry.credit = sum;
    balanceMap.set(row.studentId, entry);
  }

  let updated = 0;

  for (const student of students) {
    const totals = balanceMap.get(student.id) ?? { debit: 0, credit: 0 };
    const balance = totals.debit - totals.credit;

    await prisma.studentFinancialSummary.upsert({
      where: { studentId: student.id },
      create: {
        studentId: student.id,
        organizationId,
        campusId: student.campusId,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        balance,
      },
      update: {
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        balance,
      },
    });
    updated++;
  }

  return updated;
}
