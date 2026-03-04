import { prisma } from "@/lib/prisma";
import { copyClassStructure } from "./class-section.service";
import { emit } from "@/lib/events";

/* ── Types ──────────────────────────────────────────────── */

export interface RolloverInput {
  organizationId: string;
  fromAcademicYearId: string;
  newYearName: string;
  newYearStartDate: Date;
  newYearEndDate: Date;
  cloneSubjects?: boolean;
  userId: number;
}

export interface PromotionConfig {
  passingPercentage: number;
  useAttendance: boolean;
  minAttendancePercentage: number;
}

export interface RunPromotionInput {
  organizationId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  config: PromotionConfig;
  userId: number;
}

export interface PromotionDecision {
  enrollmentId: string;
  studentId: number;
  campusId: number;
  currentClassId: string;
  action: "PROMOTED" | "RETAINED" | "GRADUATED";
  targetClassId: string | null;
  reason: string;
}

export interface ReadinessCheck {
  ready: boolean;
  issues: string[];
}

export interface RolloverResult {
  newAcademicYear: { id: string; name: string };
  classesCloned: number;
  sectionsCloned: number;
}

export interface PromotionResult {
  promotionRunId: string;
  totalStudents: number;
  promoted: number;
  retained: number;
  graduated: number;
  errors: number;
}

/* ══════════════════════════════════════════════════════════
   READINESS CHECK
   ══════════════════════════════════════════════════════════ */

export async function checkRolloverReadiness(
  organizationId: string,
  academicYearId: string,
): Promise<ReadinessCheck> {
  const issues: string[] = [];

  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
  });

  if (!year || year.organizationId !== organizationId) {
    return { ready: false, issues: ["Academic year not found"] };
  }

  if (year.status !== "ACTIVE" || !year.isActive) {
    issues.push("Academic year is not in ACTIVE status");
  }

  const existingRun = await prisma.promotionRun.findUnique({
    where: {
      organizationId_fromAcademicYearId: {
        organizationId,
        fromAcademicYearId: academicYearId,
      },
    },
  });

  if (existingRun?.status === "COMPLETED") {
    issues.push("Promotion has already been completed for this academic year");
  }
  if (existingRun?.status === "PROCESSING") {
    issues.push("A promotion run is currently in progress");
  }

  const draftExams = await prisma.exam.count({
    where: {
      organizationId,
      academicYearId,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
  });

  if (draftExams > 0) {
    issues.push(`${draftExams} exam(s) are still in DRAFT or ACTIVE status — must be LOCKED or PUBLISHED`);
  }

  const pendingPostings = await prisma.postingRun.count({
    where: {
      organizationId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });

  if (pendingPostings > 0) {
    issues.push(`${pendingPostings} fee posting run(s) are still pending or processing`);
  }

  return { ready: issues.length === 0, issues };
}

/* ══════════════════════════════════════════════════════════
   STEP 1: ROLLOVER — Create New Year + Clone Structure
   ══════════════════════════════════════════════════════════ */

export async function rolloverStructure(input: RolloverInput): Promise<RolloverResult> {
  const {
    organizationId, fromAcademicYearId,
    newYearName, newYearStartDate, newYearEndDate,
    cloneSubjects, userId,
  } = input;

  const fromYear = await prisma.academicYear.findUnique({
    where: { id: fromAcademicYearId },
  });

  if (!fromYear || fromYear.organizationId !== organizationId) {
    throw new PromotionError("Source academic year not found");
  }

  if (fromYear.status !== "ACTIVE") {
    throw new PromotionError("Source academic year must be ACTIVE");
  }

  if (newYearEndDate <= newYearStartDate) {
    throw new PromotionError("End date must be after start date");
  }

  const overlap = await prisma.academicYear.findFirst({
    where: {
      organizationId,
      status: { not: "ARCHIVED" },
      id: { not: fromAcademicYearId },
      OR: [
        { startDate: { lte: newYearEndDate }, endDate: { gte: newYearStartDate } },
      ],
    },
  });

  if (overlap) {
    throw new PromotionError(`Date range overlaps with existing year: ${overlap.name}`);
  }

  const newYear = await prisma.academicYear.create({
    data: {
      organizationId,
      name: newYearName,
      startDate: newYearStartDate,
      endDate: newYearEndDate,
      status: "DRAFT",
      isActive: false,
    },
  });

  const { classCount, sectionCount } = await copyClassStructure(
    fromAcademicYearId,
    newYear.id,
    organizationId,
  );

  if (cloneSubjects) {
    await cloneSubjectsToNewYear(organizationId, fromAcademicYearId, newYear.id);
  }

  void userId;

  return {
    newAcademicYear: { id: newYear.id, name: newYear.name },
    classesCloned: classCount,
    sectionsCloned: sectionCount,
  };
}

/* ══════════════════════════════════════════════════════════
   STEP 2: PROMOTION ENGINE — Process All Students
   ══════════════════════════════════════════════════════════ */

const PROMOTE_BATCH = 200;

export async function runPromotion(input: RunPromotionInput): Promise<PromotionResult> {
  const { organizationId, fromAcademicYearId, toAcademicYearId, config, userId } = input;

  if (fromAcademicYearId === toAcademicYearId) {
    throw new PromotionError("Source and target academic year must differ");
  }

  const [fromYear, toYear] = await prisma.$transaction([
    prisma.academicYear.findUniqueOrThrow({ where: { id: fromAcademicYearId } }),
    prisma.academicYear.findUniqueOrThrow({ where: { id: toAcademicYearId } }),
  ]);

  if (fromYear.organizationId !== organizationId || toYear.organizationId !== organizationId) {
    throw new PromotionError("Academic years do not belong to this organization");
  }

  if (fromYear.status !== "ACTIVE") {
    throw new PromotionError("Source academic year must be ACTIVE");
  }

  if (toYear.status === "CLOSED" || toYear.status === "ARCHIVED") {
    throw new PromotionError("Target academic year cannot be CLOSED or ARCHIVED");
  }

  let promotionRun: { id: string };

  try {
    promotionRun = await prisma.promotionRun.create({
      data: {
        organizationId,
        fromAcademicYearId,
        toAcademicYearId,
        status: "PROCESSING",
        initiatedByUserId: userId,
      },
    });
  } catch (err: unknown) {
    if (isPrismaUnique(err)) {
      const existing = await prisma.promotionRun.findUnique({
        where: {
          organizationId_fromAcademicYearId: {
            organizationId,
            fromAcademicYearId,
          },
        },
      });

      if (existing?.status === "COMPLETED") {
        throw new PromotionError("Promotion already completed for this academic year");
      }
      if (existing?.status === "PROCESSING") {
        throw new PromotionError("A promotion run is already in progress");
      }

      promotionRun = await prisma.promotionRun.update({
        where: { id: existing!.id },
        data: { status: "PROCESSING", toAcademicYearId, startedAt: new Date() },
      });
    } else {
      throw err;
    }
  }

  try {
    const result = await executePromotion(
      promotionRun.id, organizationId, fromAcademicYearId, toAcademicYearId, config,
    );

    await prisma.$transaction([
      prisma.promotionRun.update({
        where: { id: promotionRun.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalStudents: result.total,
          promoted: result.promoted,
          retained: result.retained,
          graduated: result.graduated,
          errors: result.errors,
        },
      }),
      prisma.academicYear.update({
        where: { id: fromAcademicYearId },
        data: { status: "CLOSED", isActive: false },
      }),
      prisma.academicYear.update({
        where: { id: toAcademicYearId },
        data: { status: "ACTIVE", isActive: true },
      }),
    ]);

    emit("PromotionRunCompleted", organizationId, {
      promotionRunId: promotionRun.id,
      fromAcademicYearId,
      toAcademicYearId,
      totalStudents: result.total,
      promoted: result.promoted,
      retained: result.retained,
      graduated: result.graduated,
      errors: result.errors,
    }, userId).catch(() => {});

    emit("AcademicYearClosed", organizationId, {
      academicYearId: fromAcademicYearId,
      name: fromYear.name,
    }, userId).catch(() => {});

    emit("AcademicYearActivated", organizationId, {
      academicYearId: toAcademicYearId,
      name: toYear.name,
    }, userId).catch(() => {});

    return {
      promotionRunId: promotionRun.id,
      totalStudents: result.total,
      promoted: result.promoted,
      retained: result.retained,
      graduated: result.graduated,
      errors: result.errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown promotion failure";

    await prisma.promotionRun.update({
      where: { id: promotionRun.id },
      data: { status: "FAILED", errorMessage: msg },
    }).catch(() => {});

    throw new PromotionError(`Promotion failed: ${msg}`);
  }
}

/* ── Core Promotion Logic ───────────────────────────────── */

interface ExecutionResult {
  total: number;
  promoted: number;
  retained: number;
  graduated: number;
  errors: number;
}

async function executePromotion(
  _runId: string,
  organizationId: string,
  fromYearId: string,
  toYearId: string,
  config: PromotionConfig,
): Promise<ExecutionResult> {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      organizationId,
      academicYearId: fromYearId,
      status: "ACTIVE",
    },
    include: {
      class: { select: { id: true, name: true, displayOrder: true, campusId: true } },
    },
  });

  if (enrollments.length === 0) {
    return { total: 0, promoted: 0, retained: 0, graduated: 0, errors: 0 };
  }

  const classMapping = await buildClassMapping(organizationId, fromYearId, toYearId);

  const decisions = await Promise.all(
    enrollments.map((e) =>
      computeDecision(e, classMapping, config),
    ),
  );

  let promoted = 0;
  let retained = 0;
  let graduated = 0;
  let errors = 0;

  for (let i = 0; i < decisions.length; i += PROMOTE_BATCH) {
    const batch = decisions.slice(i, i + PROMOTE_BATCH);

    await prisma.$transaction(async (tx) => {
      for (const decision of batch) {
        try {
          const terminalStatus = decision.action;

          await tx.studentEnrollment.update({
            where: { id: decision.enrollmentId },
            data: { status: terminalStatus },
          });

          if (decision.action === "GRADUATED") {
            graduated++;
            continue;
          }

          if (!decision.targetClassId) {
            errors++;
            continue;
          }

          const alreadyEnrolled = await tx.studentEnrollment.findUnique({
            where: {
              studentId_academicYearId: {
                studentId: decision.studentId,
                academicYearId: toYearId,
              },
            },
          });

          if (alreadyEnrolled) {
            errors++;
            continue;
          }

          await tx.studentEnrollment.create({
            data: {
              organizationId,
              academicYearId: toYearId,
              studentId: decision.studentId,
              campusId: decision.campusId,
              classId: decision.targetClassId,
              promotedFromId: decision.enrollmentId,
            },
          });

          if (decision.action === "PROMOTED") promoted++;
          if (decision.action === "RETAINED") retained++;
        } catch {
          errors++;
        }
      }
    });
  }

  return {
    total: decisions.length,
    promoted,
    retained,
    graduated,
    errors,
  };
}

/* ── Class Mapping (Old Year → New Year) ────────────────── */

type ClassMap = Map<string, { nextClassId: string | null; sameClassId: string | null }>;

async function buildClassMapping(
  organizationId: string,
  fromYearId: string,
  toYearId: string,
): Promise<ClassMap> {
  const [oldClasses, newClasses] = await prisma.$transaction([
    prisma.class.findMany({
      where: { organizationId, academicYearId: fromYearId, status: "ACTIVE" },
      orderBy: [{ campusId: "asc" }, { displayOrder: "asc" }],
    }),
    prisma.class.findMany({
      where: { organizationId, academicYearId: toYearId, status: "ACTIVE" },
      orderBy: [{ campusId: "asc" }, { displayOrder: "asc" }],
    }),
  ]);

  const newByKey = new Map<string, typeof newClasses[0]>();
  for (const c of newClasses) {
    newByKey.set(`${c.campusId}-${c.displayOrder}`, c);
    newByKey.set(`${c.campusId}-name-${c.name}`, c);
  }

  const result: ClassMap = new Map();

  for (const old of oldClasses) {
    const order = old.displayOrder ?? 999;
    const nextOrder = order + 1;

    const nextClass =
      newByKey.get(`${old.campusId}-${nextOrder}`) ?? null;

    const sameClass =
      newByKey.get(`${old.campusId}-name-${old.name}`) ??
      newByKey.get(`${old.campusId}-${order}`) ??
      null;

    result.set(old.id, {
      nextClassId: nextClass?.id ?? null,
      sameClassId: sameClass?.id ?? null,
    });
  }

  return result;
}

/* ── Promotion Decision ─────────────────────────────────── */

interface EnrollmentWithClass {
  id: string;
  studentId: number;
  campusId: number;
  classId: string;
  class: { id: string; name: string; displayOrder: number | null; campusId: number };
}

async function computeDecision(
  enrollment: EnrollmentWithClass,
  classMapping: ClassMap,
  config: PromotionConfig,
): Promise<PromotionDecision> {
  const mapping = classMapping.get(enrollment.classId);

  if (!mapping?.nextClassId && !mapping?.sameClassId) {
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      campusId: enrollment.campusId,
      currentClassId: enrollment.classId,
      action: "GRADUATED",
      targetClassId: null,
      reason: "No next class available — final year",
    };
  }

  const percentage = await getStudentFinalPercentage(enrollment.id);
  let attendancePct = 100;

  if (config.useAttendance) {
    attendancePct = await getStudentAttendancePercentage(enrollment.id);
  }

  const passedExam = percentage === null || percentage >= config.passingPercentage;
  const passedAttendance = !config.useAttendance || attendancePct >= config.minAttendancePercentage;

  if (passedExam && passedAttendance) {
    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      campusId: enrollment.campusId,
      currentClassId: enrollment.classId,
      action: "PROMOTED",
      targetClassId: mapping.nextClassId,
      reason: percentage !== null
        ? `Passed with ${percentage}% (min: ${config.passingPercentage}%)`
        : "No exam results — auto-promoted",
    };
  }

  return {
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    campusId: enrollment.campusId,
    currentClassId: enrollment.classId,
    action: "RETAINED",
    targetClassId: mapping.sameClassId,
    reason: !passedExam
      ? `Failed exam: ${percentage}% (min: ${config.passingPercentage}%)`
      : `Attendance too low: ${attendancePct}% (min: ${config.minAttendancePercentage}%)`,
  };
}

/* ── Exam & Attendance Helpers ──────────────────────────── */

async function getStudentFinalPercentage(enrollmentId: string): Promise<number | null> {
  const results = await prisma.studentExamResult.findMany({
    where: { enrollmentId },
    include: {
      exam: { select: { examType: true, status: true } },
      examSubject: { select: { totalMarks: true } },
    },
  });

  const finalResults = results.filter(
    (r) =>
      (r.exam.examType === "FINAL" || r.exam.examType === "ANNUAL") &&
      (r.exam.status === "LOCKED" || r.exam.status === "PUBLISHED"),
  );

  if (finalResults.length === 0) return null;

  const totalObtained = finalResults.reduce(
    (sum, r) => sum + Number(r.obtainedMarks),
    0,
  );
  const totalPossible = finalResults.reduce(
    (sum, r) => sum + Number(r.examSubject.totalMarks),
    0,
  );

  if (totalPossible === 0) return null;

  return Math.round((totalObtained / totalPossible) * 10000) / 100;
}

async function getStudentAttendancePercentage(enrollmentId: string): Promise<number> {
  const records = await prisma.attendance.groupBy({
    by: ["status"],
    where: { enrollmentId },
    _count: true,
  });

  if (records.length === 0) return 100;

  let total = 0;
  let effectivePresent = 0;

  for (const r of records) {
    total += r._count;
    if (r.status === "PRESENT") effectivePresent += r._count;
    if (r.status === "LATE") effectivePresent += r._count;
    if (r.status === "HALF_DAY") effectivePresent += r._count * 0.5;
  }

  return total > 0 ? Math.round((effectivePresent / total) * 10000) / 100 : 100;
}

/* ── Clone Subjects ─────────────────────────────────────── */

async function cloneSubjectsToNewYear(
  organizationId: string,
  fromYearId: string,
  toYearId: string,
) {
  const oldSubjects = await prisma.subject.findMany({
    where: { organizationId, academicYearId: fromYearId, status: "ACTIVE" },
  });

  if (oldSubjects.length === 0) return;

  const oldClasses = await prisma.class.findMany({
    where: { organizationId, academicYearId: fromYearId, status: "ACTIVE" },
    select: { id: true, campusId: true, name: true },
  });

  const newClasses = await prisma.class.findMany({
    where: { organizationId, academicYearId: toYearId, status: "ACTIVE" },
    select: { id: true, campusId: true, name: true },
  });

  const classIdMap = new Map<string, string>();
  for (const old of oldClasses) {
    const match = newClasses.find(
      (n) => n.campusId === old.campusId && n.name === old.name,
    );
    if (match) classIdMap.set(old.id, match.id);
  }

  const subjectsToCreate = oldSubjects
    .filter((s) => classIdMap.has(s.classId))
    .map((s) => ({
      organizationId,
      academicYearId: toYearId,
      campusId: s.campusId,
      classId: classIdMap.get(s.classId)!,
      name: s.name,
      code: s.code,
    }));

  if (subjectsToCreate.length > 0) {
    await prisma.subject.createMany({
      data: subjectsToCreate,
      skipDuplicates: true,
    });
  }
}

/* ══════════════════════════════════════════════════════════
   QUERY HELPERS
   ══════════════════════════════════════════════════════════ */

export async function getPromotionRun(organizationId: string, fromYearId: string) {
  return prisma.promotionRun.findUnique({
    where: {
      organizationId_fromAcademicYearId: {
        organizationId,
        fromAcademicYearId: fromYearId,
      },
    },
    include: {
      fromAcademicYear: { select: { name: true } },
      toAcademicYear: { select: { name: true } },
      initiatedBy: { select: { name: true, email: true } },
    },
  });
}

export async function listPromotionRuns(organizationId: string) {
  return prisma.promotionRun.findMany({
    where: { organizationId },
    orderBy: { startedAt: "desc" },
    include: {
      fromAcademicYear: { select: { name: true } },
      toAcademicYear: { select: { name: true } },
      initiatedBy: { select: { name: true, email: true } },
    },
  });
}

/* ── Helpers ────────────────────────────────────────────── */

function isPrismaUnique(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/* ── Custom Error ───────────────────────────────────────── */

export class PromotionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionError";
  }
}
