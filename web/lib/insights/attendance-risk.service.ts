import { prisma } from "@/lib/prisma";

const ABSENCE_RATE_WEIGHT = 35;
const TREND_WEIGHT = 25;
const CONSECUTIVE_WEIGHT = 20;
const LATE_WEIGHT = 10;
const DROPOUT_SIMILARITY_WEIGHT = 10;

const DEFAULT_ATTENDANCE_RISK_THRESHOLD = Number(
  process.env.ATTENDANCE_RISK_THRESHOLD ?? 60,
);

export type AttendanceRiskStudent = {
  studentId: number;
  name: string;
  className: string;
  sectionName: string;
  riskScore: number;
  absenceRate30Days: number;
  consecutiveAbsences: number;
  lateArrivalRate: number;
};

export type AttendanceRiskCluster = {
  className: string;
  riskyCount: number;
};

type AttendanceRiskFactors = {
  absenceRate30Days: number;
  increasingAbsenceTrend: boolean;
  consecutiveAbsences: number;
  lateArrivalRate: number;
  dropoutPatternSimilarity: boolean;
};

function toDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateAttendanceRisk(factors: AttendanceRiskFactors): number {
  let score = 0;

  if (factors.absenceRate30Days > 0.3) score += ABSENCE_RATE_WEIGHT;
  if (factors.increasingAbsenceTrend) score += TREND_WEIGHT;
  if (factors.consecutiveAbsences >= 3) score += CONSECUTIVE_WEIGHT;
  if (factors.lateArrivalRate > 0.25) score += LATE_WEIGHT;
  if (factors.dropoutPatternSimilarity) score += DROPOUT_SIMILARITY_WEIGHT;

  return Math.max(0, Math.min(100, score));
}

function detectClassClusters(students: AttendanceRiskStudent[]): AttendanceRiskCluster[] {
  const grouped = new Map<string, number>();
  for (const student of students) {
    grouped.set(student.className, (grouped.get(student.className) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([className, riskyCount]) => ({ className, riskyCount }))
    .filter((entry) => entry.riskyCount >= 5)
    .sort((a, b) => b.riskyCount - a.riskyCount);
}

function getConsecutiveAbsences(
  records: Array<{ date: Date; status: string }>,
  today: Date,
): number {
  const dayMap = new Map<string, string>();
  for (const record of records) {
    dayMap.set(toDayStart(record.date).toISOString(), record.status);
  }

  let streak = 0;
  for (let i = 0; i < 14; i += 1) {
    const probe = new Date(today);
    probe.setUTCDate(probe.getUTCDate() - i);
    const key = toDayStart(probe).toISOString();
    const status = dayMap.get(key);
    if (status === "ABSENT") {
      streak += 1;
      continue;
    }
    if (status) {
      break;
    }
  }

  return streak;
}

export async function getAttendanceRisks(input: {
  organizationId: string;
  campusId?: number;
  threshold?: number;
}) {
  const threshold = Number.isFinite(input.threshold ?? NaN)
    ? Number(input.threshold)
    : DEFAULT_ATTENDANCE_RISK_THRESHOLD;

  const today = toDayStart(new Date());
  const last30Start = new Date(today);
  last30Start.setUTCDate(last30Start.getUTCDate() - 30);
  const prev30Start = new Date(last30Start);
  prev30Start.setUTCDate(prev30Start.getUTCDate() - 30);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      organizationId: input.organizationId,
      status: "ACTIVE",
      ...(input.campusId ? { campusId: input.campusId } : {}),
    },
    select: {
      studentId: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
      student: {
        select: {
          fullName: true,
          enrollments: {
            where: {
              status: { in: ["WITHDRAWN", "TRANSFERRED", "RETAINED"] },
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const studentIds = enrollments.map((row) => row.studentId);
  if (!studentIds.length) {
    return {
      threshold,
      students: [] as AttendanceRiskStudent[],
      clusters: [] as AttendanceRiskCluster[],
    };
  }

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      organizationId: input.organizationId,
      studentId: { in: studentIds },
      date: { gte: prev30Start },
      ...(input.campusId ? { campusId: input.campusId } : {}),
    },
    select: {
      studentId: true,
      date: true,
      status: true,
    },
    orderBy: { date: "desc" },
  });

  const attendanceByStudent = new Map<
    number,
    Array<{ date: Date; status: string }>
  >();
  for (const row of attendanceRows) {
    const list = attendanceByStudent.get(row.studentId) ?? [];
    list.push({ date: row.date, status: row.status });
    attendanceByStudent.set(row.studentId, list);
  }

  const riskyStudents: AttendanceRiskStudent[] = [];

  for (const enrollment of enrollments) {
    const records = attendanceByStudent.get(enrollment.studentId) ?? [];

    const last30 = records.filter((record) => record.date >= last30Start);
    const prev30 = records.filter(
      (record) => record.date >= prev30Start && record.date < last30Start,
    );

    const last30Total = last30.length;
    const last30Absences = last30.filter((r) => r.status === "ABSENT").length;
    const last30Late = last30.filter((r) => r.status === "LATE").length;
    const prev30Total = prev30.length;
    const prev30Absences = prev30.filter((r) => r.status === "ABSENT").length;

    const absenceRate30Days =
      last30Total > 0 ? last30Absences / last30Total : 0;
    const previousAbsenceRate =
      prev30Total > 0 ? prev30Absences / prev30Total : 0;
    const increasingAbsenceTrend = absenceRate30Days > previousAbsenceRate + 0.05;
    const consecutiveAbsences = getConsecutiveAbsences(records, today);
    const lateArrivalRate = last30Total > 0 ? last30Late / last30Total : 0;

    const factors: AttendanceRiskFactors = {
      absenceRate30Days,
      increasingAbsenceTrend,
      consecutiveAbsences,
      lateArrivalRate,
      dropoutPatternSimilarity:
        enrollment.student.enrollments.length > 0 ||
        (absenceRate30Days > 0.4 && consecutiveAbsences >= 4),
    };

    const riskScore = calculateAttendanceRisk(factors);
    if (riskScore >= threshold) {
      riskyStudents.push({
        studentId: enrollment.studentId,
        name: enrollment.student.fullName,
        className: enrollment.class.name,
        sectionName: enrollment.section?.name ?? "-",
        riskScore,
        absenceRate30Days: Number(absenceRate30Days.toFixed(2)),
        consecutiveAbsences,
        lateArrivalRate: Number(lateArrivalRate.toFixed(2)),
      });
    }
  }

  riskyStudents.sort((a, b) => b.riskScore - a.riskScore);

  return {
    threshold,
    students: riskyStudents,
    clusters: detectClassClusters(riskyStudents),
  };
}
