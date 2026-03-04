/**
 * Campus Health Score Engine
 *
 * Computes a composite health score per campus based on:
 *   - Collection Rate   (40% weight) — how much revenue is collected vs billed
 *   - Attendance Rate    (30% weight) — average daily attendance %
 *   - Academic Score     (20% weight) — exam pass rate
 *   - Enrollment Growth  (10% weight) — year-over-year enrollment change
 *
 * Scores are materialized into CampusHealthScore for O(1) dashboard reads.
 * Designed to run as a scheduled background job (daily or weekly).
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

/* ── Types ────────────────────────────────────────────── */

interface CampusHealthData {
  campusId: number;
  collectionRate: number;
  attendanceRate: number;
  academicScore: number;
  enrollmentGrowth: number;
  compositeScore: number;
  riskLevel: string;
}

const WEIGHTS = {
  collection: 0.4,
  attendance: 0.3,
  academic: 0.2,
  enrollment: 0.1,
};

function computeRisk(score: number): string {
  if (score >= 75) return "LOW";
  if (score >= 50) return "MODERATE";
  if (score >= 30) return "HIGH";
  return "CRITICAL";
}

/* ── Core Computation ─────────────────────────────────── */

export async function computeAllCampusHealthScores(
  organizationId: string,
): Promise<CampusHealthData[]> {
  const campuses = await prisma.campus.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true },
  });

  if (campuses.length === 0) return [];

  const campusIds = campuses.map((c) => c.id);

  const [collectionMap, attendanceMap, academicMap, enrollmentMap] =
    await Promise.all([
      computeCollectionRates(organizationId, campusIds),
      computeAttendanceRates(organizationId, campusIds),
      computeAcademicScores(organizationId, campusIds),
      computeEnrollmentGrowth(organizationId, campusIds),
    ]);

  const results: CampusHealthData[] = [];

  for (const campusId of campusIds) {
    const collection = collectionMap.get(campusId) ?? 0;
    const attendance = attendanceMap.get(campusId) ?? 0;
    const academic = academicMap.get(campusId) ?? 0;
    const enrollment = enrollmentMap.get(campusId) ?? 0;

    const composite = Math.round(
      collection * WEIGHTS.collection +
        attendance * WEIGHTS.attendance +
        academic * WEIGHTS.academic +
        enrollment * WEIGHTS.enrollment,
    );

    results.push({
      campusId,
      collectionRate: Math.round(collection * 100) / 100,
      attendanceRate: Math.round(attendance * 100) / 100,
      academicScore: Math.round(academic * 100) / 100,
      enrollmentGrowth: Math.round(enrollment * 100) / 100,
      compositeScore: Math.min(100, Math.max(0, composite)),
      riskLevel: computeRisk(composite),
    });
  }

  return results;
}

/* ── Sub-Computations (O(1) query set via groupBy) ───── */

async function computeCollectionRates(
  organizationId: string,
  campusIds: number[],
): Promise<Map<number, number>> {
  const challanStats = await prisma.feeChallan.groupBy({
    by: ["campusId"],
    where: {
      organizationId,
      campusId: { in: campusIds },
      status: { not: "CANCELLED" },
    },
    _sum: { totalAmount: true, paidAmount: true },
  });

  const map = new Map<number, number>();

  for (const row of challanStats) {
    const total = Number(row._sum.totalAmount ?? 0);
    const paid = Number(row._sum.paidAmount ?? 0);
    const rate = total > 0 ? (paid / total) * 100 : 0;
    map.set(row.campusId, Math.min(100, rate));
  }

  return map;
}

async function computeAttendanceRates(
  organizationId: string,
  campusIds: number[],
): Promise<Map<number, number>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const attendanceCounts = await prisma.attendance.groupBy({
    by: ["campusId", "status"],
    where: {
      organizationId,
      campusId: { in: campusIds },
      date: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  const campusTotals = new Map<number, { present: number; total: number }>();

  for (const row of attendanceCounts) {
    const entry = campusTotals.get(row.campusId) ?? { present: 0, total: 0 };
    entry.total += row._count;
    if (row.status === "PRESENT" || row.status === "LATE") {
      entry.present += row._count;
    }
    campusTotals.set(row.campusId, entry);
  }

  const map = new Map<number, number>();
  for (const [campusId, stats] of campusTotals) {
    map.set(
      campusId,
      stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
    );
  }

  return map;
}

async function computeAcademicScores(
  organizationId: string,
  campusIds: number[],
): Promise<Map<number, number>> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
  });

  if (!activeYear) {
    return new Map(campusIds.map((id) => [id, 0]));
  }

  const exams = await prisma.exam.findMany({
    where: {
      organizationId,
      academicYearId: activeYear.id,
      campusId: { in: campusIds },
      status: "PUBLISHED",
    },
    select: { id: true, campusId: true },
  });

  if (exams.length === 0) {
    return new Map(campusIds.map((id) => [id, 0]));
  }

  const examIds = exams.map((e) => e.id);
  const examToCampus = new Map<string, number>();
  for (const e of exams) {
    examToCampus.set(e.id, e.campusId);
  }

  const results = await prisma.studentExamResult.findMany({
    where: { examId: { in: examIds } },
    select: { examId: true, obtainedMarks: true },
  });

  const examSubjects = await prisma.examSubject.findMany({
    where: { examId: { in: examIds } },
    select: { examId: true, passingMarks: true },
  });

  const passingMarksMap = new Map<string, number>();
  for (const es of examSubjects) {
    const current = passingMarksMap.get(es.examId) ?? 0;
    passingMarksMap.set(es.examId, Math.max(current, Number(es.passingMarks)));
  }

  const campusPass = new Map<number, { pass: number; total: number }>();

  for (const r of results) {
    const cId = examToCampus.get(r.examId);
    if (cId === undefined) continue;

    const entry = campusPass.get(cId) ?? { pass: 0, total: 0 };
    entry.total++;

    const passMark = passingMarksMap.get(r.examId) ?? 0;
    if (Number(r.obtainedMarks) >= passMark) {
      entry.pass++;
    }
    campusPass.set(cId, entry);
  }

  const map = new Map<number, number>();
  for (const campusId of campusIds) {
    const stats = campusPass.get(campusId);
    map.set(
      campusId,
      stats && stats.total > 0 ? (stats.pass / stats.total) * 100 : 0,
    );
  }

  return map;
}

async function computeEnrollmentGrowth(
  organizationId: string,
  campusIds: number[],
): Promise<Map<number, number>> {
  const years = await prisma.academicYear.findMany({
    where: { organizationId },
    orderBy: { startDate: "desc" },
    take: 2,
    select: { id: true },
  });

  if (years.length < 2) {
    return new Map(campusIds.map((id) => [id, 50]));
  }

  const [currentYearId, previousYearId] = [years[0].id, years[1].id];

  const [currentCounts, previousCounts] = await Promise.all([
    prisma.studentEnrollment.groupBy({
      by: ["campusId"],
      where: {
        organizationId,
        academicYearId: currentYearId,
        campusId: { in: campusIds },
        status: "ACTIVE",
      },
      _count: true,
    }),
    prisma.studentEnrollment.groupBy({
      by: ["campusId"],
      where: {
        organizationId,
        academicYearId: previousYearId,
        campusId: { in: campusIds },
      },
      _count: true,
    }),
  ]);

  const currentMap = new Map<number, number>();
  for (const row of currentCounts) currentMap.set(row.campusId, row._count);

  const previousMap = new Map<number, number>();
  for (const row of previousCounts) previousMap.set(row.campusId, row._count);

  const map = new Map<number, number>();
  for (const campusId of campusIds) {
    const curr = currentMap.get(campusId) ?? 0;
    const prev = previousMap.get(campusId) ?? 0;

    if (prev === 0) {
      map.set(campusId, curr > 0 ? 100 : 50);
    } else {
      const growthPct = ((curr - prev) / prev) * 100;
      const normalized = Math.min(100, Math.max(0, 50 + growthPct));
      map.set(campusId, normalized);
    }
  }

  return map;
}

/* ── Materialization ──────────────────────────────────── */

/**
 * Recomputes and persists health scores for all active campuses.
 * Called by a background job (daily recommended).
 */
export async function refreshCampusHealthScores(
  organizationId: string,
): Promise<number> {
  const scores = await computeAllCampusHealthScores(organizationId);

  const operations: Prisma.PrismaPromise<unknown>[] = scores.map((s) =>
    prisma.campusHealthScore.upsert({
      where: {
        organizationId_campusId: {
          organizationId,
          campusId: s.campusId,
        },
      },
      create: {
        organizationId,
        campusId: s.campusId,
        collectionRate: s.collectionRate,
        attendanceRate: s.attendanceRate,
        academicScore: s.academicScore,
        enrollmentGrowth: s.enrollmentGrowth,
        compositeScore: s.compositeScore,
        riskLevel: s.riskLevel,
      },
      update: {
        collectionRate: s.collectionRate,
        attendanceRate: s.attendanceRate,
        academicScore: s.academicScore,
        enrollmentGrowth: s.enrollmentGrowth,
        compositeScore: s.compositeScore,
        riskLevel: s.riskLevel,
      },
    }),
  );

  await prisma.$transaction(operations);

  return scores.length;
}

/**
 * Fetches persisted health scores for all campuses (O(1) read).
 */
export async function getCampusHealthScores(organizationId: string) {
  return prisma.campusHealthScore.findMany({
    where: { organizationId },
    orderBy: { compositeScore: "desc" },
  });
}
