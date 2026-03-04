import { prisma } from "@/lib/prisma";

const LATE_PAYMENT_WEIGHT = 30;
const AVG_DELAY_WEIGHT = 25;
const PARTIAL_PAYMENT_WEIGHT = 20;
const TREND_WEIGHT = 15;
const REMINDER_WEIGHT = 10;

const DEFAULT_RISK_THRESHOLD = Number(
  process.env.PREDICTIVE_FEE_RISK_THRESHOLD ?? 65,
);

export type PredictedDefaulter = {
  studentId: number;
  name: string;
  admissionNo: string;
  grade: string;
  campusId: number;
  riskScore: number;
  latePaymentRate: number;
  avgDelayDays: number;
  partialPaymentRatio: number;
  ignoredReminders: number;
};

type StudentRiskFactors = {
  latePaymentRate: number;
  avgDelayDays: number;
  partialPaymentRatio: number;
  last3MonthIncreasingDelay: boolean;
  ignoredReminders: number;
};

function daysBetween(left: Date, right: Date): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((right.getTime() - left.getTime()) / DAY_MS));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calculateDefaultRisk(student: StudentRiskFactors): number {
  let score = 0;

  if (student.latePaymentRate > 0.5) score += LATE_PAYMENT_WEIGHT;
  if (student.avgDelayDays > 10) score += AVG_DELAY_WEIGHT;
  if (student.partialPaymentRatio > 0.4) score += PARTIAL_PAYMENT_WEIGHT;
  if (student.last3MonthIncreasingDelay) score += TREND_WEIGHT;
  if (student.ignoredReminders > 2) score += REMINDER_WEIGHT;

  return Math.max(0, Math.min(100, score));
}

function isIncreasing(values: number[]): boolean {
  if (values.length < 3) return false;
  return values[0] < values[1] && values[1] < values[2];
}

export async function getPredictedDefaulters(input: {
  organizationId: string;
  campusId?: number;
  threshold?: number;
}) {
  const threshold = Number.isFinite(input.threshold ?? NaN)
    ? Number(input.threshold)
    : DEFAULT_RISK_THRESHOLD;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [challans, reminderLogs] = await Promise.all([
    prisma.feeChallan.findMany({
      where: {
        organizationId: input.organizationId,
        dueDate: { gte: sixMonthsAgo },
        ...(input.campusId ? { campusId: input.campusId } : {}),
      },
      select: {
        studentId: true,
        dueDate: true,
        paidAt: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        student: {
          select: {
            fullName: true,
            admissionNo: true,
            grade: true,
            campusId: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.reminderLog.findMany({
      where: {
        organizationId: input.organizationId,
        sentAt: { gte: sixMonthsAgo },
        triggerType: { in: ["AFTER_DUE", "FINAL_NOTICE"] },
      },
      select: {
        studentId: true,
        status: true,
      },
    }),
  ]);

  const ignoredReminderMap = new Map<number, number>();
  for (const log of reminderLogs) {
    if (log.status === "DELIVERED" || log.status === "READ") {
      continue;
    }
    ignoredReminderMap.set(
      log.studentId,
      (ignoredReminderMap.get(log.studentId) ?? 0) + 1,
    );
  }

  const byStudent = new Map<
    number,
    {
      name: string;
      admissionNo: string;
      grade: string;
      campusId: number;
      total: number;
      late: number;
      delayTotal: number;
      partial: number;
      monthlyDelay: Map<string, { totalDelay: number; count: number }>;
    }
  >();

  const now = new Date();
  for (const row of challans) {
    if (!byStudent.has(row.studentId)) {
      byStudent.set(row.studentId, {
        name: row.student.fullName,
        admissionNo: row.student.admissionNo,
        grade: row.student.grade,
        campusId: row.student.campusId,
        total: 0,
        late: 0,
        delayTotal: 0,
        partial: 0,
        monthlyDelay: new Map(),
      });
    }

    const entry = byStudent.get(row.studentId)!;
    entry.total += 1;

    const settledAt = row.paidAt ?? now;
    const delayDays = daysBetween(row.dueDate, settledAt);
    if (delayDays > 0) {
      entry.late += 1;
    }

    entry.delayTotal += delayDays;

    const totalAmount = Number(row.totalAmount);
    const paidAmount = Number(row.paidAmount);
    if (paidAmount > 0 && paidAmount < totalAmount) {
      entry.partial += 1;
    }

    const key = monthKey(row.dueDate);
    const month = entry.monthlyDelay.get(key) ?? { totalDelay: 0, count: 0 };
    month.totalDelay += delayDays;
    month.count += 1;
    entry.monthlyDelay.set(key, month);
  }

  const risky: PredictedDefaulter[] = [];
  for (const [studentId, row] of byStudent) {
    if (row.total < 2) {
      continue;
    }

    const monthValues = Array.from(row.monthlyDelay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-3)
      .map(([, data]) => (data.count > 0 ? data.totalDelay / data.count : 0));

    const factors: StudentRiskFactors = {
      latePaymentRate: row.total > 0 ? row.late / row.total : 0,
      avgDelayDays: row.total > 0 ? row.delayTotal / row.total : 0,
      partialPaymentRatio: row.total > 0 ? row.partial / row.total : 0,
      last3MonthIncreasingDelay: isIncreasing(monthValues),
      ignoredReminders: ignoredReminderMap.get(studentId) ?? 0,
    };

    const score = calculateDefaultRisk(factors);
    if (score >= threshold) {
      risky.push({
        studentId,
        name: row.name,
        admissionNo: row.admissionNo,
        grade: row.grade,
        campusId: row.campusId,
        riskScore: score,
        latePaymentRate: Number(factors.latePaymentRate.toFixed(2)),
        avgDelayDays: Number(factors.avgDelayDays.toFixed(1)),
        partialPaymentRatio: Number(factors.partialPaymentRatio.toFixed(2)),
        ignoredReminders: factors.ignoredReminders,
      });
    }
  }

  risky.sort((a, b) => b.riskScore - a.riskScore);

  return {
    count: risky.length,
    threshold,
    students: risky,
  };
}
