import { prisma } from "@/lib/prisma";
import type { ExamType, ExamStatus } from "@/lib/generated/prisma";
import { assertYearOpen } from "./academic-year.service";

/* ── Types ──────────────────────────────────────────────── */

export interface ScopeFilter {
  organizationId: string;
  campusId?: number;
  unitPath?: string | null;
}

/* ─── Subject ─── */

export interface CreateSubjectInput {
  organizationId: string;
  academicYearId: string;
  campusId: number;
  classId: string;
  name: string;
  code?: string;
}

/* ─── Exam ─── */

export interface CreateExamInput {
  organizationId: string;
  academicYearId: string;
  campusId: number;
  classId: string;
  sectionId?: string;
  name: string;
  examType: ExamType;
  startDate: Date;
  endDate: Date;
  subjects: Array<{
    subjectId: string;
    totalMarks: number;
    passingMarks: number;
  }>;
}

export interface UpdateExamInput {
  name?: string;
  startDate?: Date;
  endDate?: Date;
}

/* ─── Results ─── */

export interface ResultEntry {
  enrollmentId: string;
  studentId: number;
  examSubjectId: string;
  obtainedMarks: number;
  remarks?: string;
}

export interface BulkResultInput {
  organizationId: string;
  academicYearId: string;
  examId: string;
  entries: ResultEntry[];
}

export interface TabulationRow {
  enrollmentId: string;
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNumber: string | null;
  subjects: Array<{
    examSubjectId: string;
    subjectName: string;
    totalMarks: number;
    passingMarks: number;
    obtainedMarks: number;
    passed: boolean;
  }>;
  totalObtained: number;
  totalPossible: number;
  percentage: number;
  grade: string | null;
  rank: number;
}

/* ══════════════════════════════════════════════════════════
   SUBJECT CRUD
   ══════════════════════════════════════════════════════════ */

export async function listSubjects(
  scope: ScopeFilter,
  academicYearId: string,
  classId?: string,
) {
  const where: Record<string, unknown> = {
    organizationId: scope.organizationId,
    academicYearId,
    status: "ACTIVE",
  };

  if (classId) where.classId = classId;
  if (scope.campusId) where.campusId = scope.campusId;
  else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  return prisma.subject.findMany({
    where,
    orderBy: [{ class: { displayOrder: "asc" } }, { name: "asc" }],
    include: { class: { select: { name: true } } },
  });
}

export async function createSubject(input: CreateSubjectInput) {
  await assertYearOpen(input.academicYearId);
  return prisma.subject.create({ data: input });
}

export async function updateSubject(
  subjectId: string,
  organizationId: string,
  data: { name?: string; code?: string },
) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject || subject.organizationId !== organizationId) {
    throw new ExamError("Subject not found");
  }
  await assertYearOpen(subject.academicYearId);
  return prisma.subject.update({ where: { id: subjectId }, data });
}

export async function archiveSubject(subjectId: string, organizationId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject || subject.organizationId !== organizationId) {
    throw new ExamError("Subject not found");
  }
  return prisma.subject.update({
    where: { id: subjectId },
    data: { status: "ARCHIVED" },
  });
}

export async function bulkCreateSubjects(
  organizationId: string,
  academicYearId: string,
  campusId: number,
  classId: string,
  names: string[],
) {
  await assertYearOpen(academicYearId);

  return prisma.$transaction(
    names.map((name) =>
      prisma.subject.create({
        data: { organizationId, academicYearId, campusId, classId, name },
      }),
    ),
  );
}

/* ══════════════════════════════════════════════════════════
   EXAM CRUD & LIFECYCLE
   ══════════════════════════════════════════════════════════ */

export async function createExam(input: CreateExamInput) {
  const {
    organizationId, academicYearId, campusId, classId, sectionId,
    name, examType, startDate, endDate, subjects,
  } = input;

  await assertYearOpen(academicYearId);

  if (endDate <= startDate) {
    throw new ExamError("End date must be after start date");
  }

  if (subjects.length === 0) {
    throw new ExamError("At least one subject is required");
  }

  const grandTotal = subjects.reduce((sum, s) => sum + s.totalMarks, 0);

  return prisma.$transaction(async (tx) => {
    const exam = await tx.exam.create({
      data: {
        organizationId,
        academicYearId,
        campusId,
        classId,
        sectionId,
        name,
        examType,
        startDate,
        endDate,
        totalMarks: grandTotal,
        status: "DRAFT",
      },
    });

    await tx.examSubject.createMany({
      data: subjects.map((s) => ({
        examId: exam.id,
        subjectId: s.subjectId,
        totalMarks: s.totalMarks,
        passingMarks: s.passingMarks,
      })),
    });

    return tx.exam.findUniqueOrThrow({
      where: { id: exam.id },
      include: {
        examSubjects: { include: { subject: { select: { name: true, code: true } } } },
      },
    });
  });
}

export async function getExam(examId: string, organizationId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examSubjects: {
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { subject: { name: "asc" } },
      },
      class: { select: { name: true } },
      section: { select: { name: true } },
      _count: { select: { results: true } },
    },
  });

  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }

  return exam;
}

export async function listExams(
  scope: ScopeFilter,
  academicYearId: string,
  options: { classId?: string; sectionId?: string; status?: ExamStatus } = {},
) {
  const where: Record<string, unknown> = {
    organizationId: scope.organizationId,
    academicYearId,
  };

  if (scope.campusId) where.campusId = scope.campusId;
  else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  if (options.classId) where.classId = options.classId;
  if (options.sectionId) where.sectionId = options.sectionId;
  if (options.status) where.status = options.status;

  return prisma.exam.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      _count: { select: { examSubjects: true, results: true } },
    },
  });
}

export async function updateExam(
  examId: string,
  organizationId: string,
  data: UpdateExamInput,
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }
  if (exam.status !== "DRAFT") {
    throw new ExamError("Only DRAFT exams can be edited");
  }

  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    throw new ExamError("End date must be after start date");
  }

  return prisma.exam.update({ where: { id: examId }, data });
}

export async function changeExamStatus(
  examId: string,
  organizationId: string,
  targetStatus: ExamStatus,
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }

  const allowed: Record<string, string[]> = {
    DRAFT: ["ACTIVE"],
    ACTIVE: ["LOCKED"],
    LOCKED: ["PUBLISHED", "ACTIVE"],
    PUBLISHED: ["LOCKED"],
  };

  if (!allowed[exam.status]?.includes(targetStatus)) {
    throw new ExamError(
      `Cannot transition from ${exam.status} to ${targetStatus}`,
    );
  }

  return prisma.exam.update({
    where: { id: examId },
    data: { status: targetStatus },
  });
}

/* ══════════════════════════════════════════════════════════
   EXAM SUBJECT MANAGEMENT
   ══════════════════════════════════════════════════════════ */

export async function addExamSubject(
  examId: string,
  organizationId: string,
  subjectId: string,
  totalMarks: number,
  passingMarks: number,
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }
  if (exam.status !== "DRAFT") {
    throw new ExamError("Subjects can only be added to DRAFT exams");
  }

  const es = await prisma.examSubject.create({
    data: { examId, subjectId, totalMarks, passingMarks },
  });

  await recalcExamTotal(examId);
  return es;
}

export async function removeExamSubject(
  examSubjectId: string,
  organizationId: string,
) {
  const es = await prisma.examSubject.findUnique({
    where: { id: examSubjectId },
    include: { exam: { select: { organizationId: true, status: true, id: true } } },
  });

  if (!es || es.exam.organizationId !== organizationId) {
    throw new ExamError("Exam subject not found");
  }
  if (es.exam.status !== "DRAFT") {
    throw new ExamError("Subjects can only be removed from DRAFT exams");
  }

  await prisma.examSubject.delete({ where: { id: examSubjectId } });
  await recalcExamTotal(es.exam.id);
}

async function recalcExamTotal(examId: string) {
  const agg = await prisma.examSubject.aggregate({
    where: { examId },
    _sum: { totalMarks: true },
  });
  await prisma.exam.update({
    where: { id: examId },
    data: { totalMarks: Number(agg._sum.totalMarks ?? 0) },
  });
}

/* ══════════════════════════════════════════════════════════
   RESULT ENTRY
   ══════════════════════════════════════════════════════════ */

const RESULT_BATCH = 500;

export async function bulkEnterResults(input: BulkResultInput) {
  const { organizationId, academicYearId, examId, entries } = input;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { examSubjects: true },
  });

  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }
  if (exam.status !== "ACTIVE") {
    throw new ExamError("Results can only be entered for ACTIVE exams");
  }

  const subjectMap = new Map(exam.examSubjects.map((es) => [es.id, es]));

  for (const entry of entries) {
    const es = subjectMap.get(entry.examSubjectId);
    if (!es) {
      throw new ExamError(`Invalid exam subject: ${entry.examSubjectId}`);
    }
    if (entry.obtainedMarks < 0 || entry.obtainedMarks > Number(es.totalMarks)) {
      throw new ExamError(
        `Marks ${entry.obtainedMarks} out of range [0, ${es.totalMarks}] for subject ${entry.examSubjectId}`,
      );
    }
  }

  let created = 0;
  let updated = 0;

  for (let i = 0; i < entries.length; i += RESULT_BATCH) {
    const batch = entries.slice(i, i + RESULT_BATCH);

    await prisma.$transaction(async (tx) => {
      for (const entry of batch) {
        const existing = await tx.studentExamResult.findUnique({
          where: {
            examSubjectId_enrollmentId: {
              examSubjectId: entry.examSubjectId,
              enrollmentId: entry.enrollmentId,
            },
          },
        });

        if (existing) {
          await tx.studentExamResult.update({
            where: { id: existing.id },
            data: {
              obtainedMarks: entry.obtainedMarks,
              remarks: entry.remarks,
            },
          });
          updated++;
        } else {
          await tx.studentExamResult.create({
            data: {
              organizationId,
              academicYearId,
              examId,
              examSubjectId: entry.examSubjectId,
              enrollmentId: entry.enrollmentId,
              studentId: entry.studentId,
              obtainedMarks: entry.obtainedMarks,
              remarks: entry.remarks,
            },
          });
          created++;
        }
      }
    });
  }

  return { created, updated, total: entries.length };
}

export async function updateSingleResult(
  resultId: string,
  organizationId: string,
  data: { obtainedMarks?: number; grade?: string; remarks?: string },
) {
  const result = await prisma.studentExamResult.findUnique({
    where: { id: resultId },
    include: { exam: { select: { status: true } }, examSubject: true },
  });

  if (!result || result.organizationId !== organizationId) {
    throw new ExamError("Result not found");
  }
  if (result.exam.status === "LOCKED" || result.exam.status === "PUBLISHED") {
    throw new ExamError("Cannot edit results of a locked/published exam");
  }

  if (data.obtainedMarks !== undefined) {
    if (data.obtainedMarks < 0 || data.obtainedMarks > Number(result.examSubject.totalMarks)) {
      throw new ExamError(
        `Marks ${data.obtainedMarks} out of range [0, ${result.examSubject.totalMarks}]`,
      );
    }
  }

  return prisma.studentExamResult.update({ where: { id: resultId }, data });
}

/* ══════════════════════════════════════════════════════════
   TABULATION & MERIT
   ══════════════════════════════════════════════════════════ */

export async function getTabulation(
  examId: string,
  organizationId: string,
): Promise<TabulationRow[]> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examSubjects: {
        include: { subject: { select: { name: true } } },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }

  const results = await prisma.studentExamResult.findMany({
    where: { examId },
    include: {
      enrollment: {
        select: {
          rollNumber: true,
          student: { select: { fullName: true, admissionNo: true } },
        },
      },
    },
  });

  const gradeScales = await prisma.gradeScale.findMany({
    where: { organizationId },
    orderBy: { minPercentage: "desc" },
  });

  const examSubjectMap = new Map(
    exam.examSubjects.map((es) => [es.id, es]),
  );

  const totalPossible = exam.examSubjects.reduce(
    (sum, es) => sum + Number(es.totalMarks),
    0,
  );

  const enrollmentMap = new Map<string, {
    enrollmentId: string;
    studentId: number;
    studentName: string;
    admissionNo: string;
    rollNumber: string | null;
    subjects: TabulationRow["subjects"];
    totalObtained: number;
  }>();

  for (const r of results) {
    const es = examSubjectMap.get(r.examSubjectId);
    if (!es) continue;

    if (!enrollmentMap.has(r.enrollmentId)) {
      enrollmentMap.set(r.enrollmentId, {
        enrollmentId: r.enrollmentId,
        studentId: r.studentId,
        studentName: r.enrollment.student.fullName,
        admissionNo: r.enrollment.student.admissionNo,
        rollNumber: r.enrollment.rollNumber,
        subjects: [],
        totalObtained: 0,
      });
    }

    const entry = enrollmentMap.get(r.enrollmentId)!;
    const obtained = Number(r.obtainedMarks);

    entry.subjects.push({
      examSubjectId: r.examSubjectId,
      subjectName: es.subject.name,
      totalMarks: Number(es.totalMarks),
      passingMarks: Number(es.passingMarks),
      obtainedMarks: obtained,
      passed: obtained >= Number(es.passingMarks),
    });

    entry.totalObtained += obtained;
  }

  const rows: TabulationRow[] = Array.from(enrollmentMap.values())
    .map((entry) => {
      const percentage =
        totalPossible > 0
          ? Math.round((entry.totalObtained / totalPossible) * 10000) / 100
          : 0;

      return {
        ...entry,
        totalPossible,
        percentage,
        grade: resolveGrade(percentage, gradeScales),
        rank: 0,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  for (let i = 0; i < rows.length; i++) {
    rows[i].rank = i + 1;
    if (i > 0 && rows[i].percentage === rows[i - 1].percentage) {
      rows[i].rank = rows[i - 1].rank;
    }
  }

  return rows;
}

/* ══════════════════════════════════════════════════════════
   GRADE SCALE CRUD
   ══════════════════════════════════════════════════════════ */

export async function listGradeScales(organizationId: string) {
  return prisma.gradeScale.findMany({
    where: { organizationId },
    orderBy: { minPercentage: "desc" },
  });
}

export async function upsertGradeScales(
  organizationId: string,
  scales: Array<{
    name: string;
    minPercentage: number;
    maxPercentage: number;
    grade: string;
    gradePoint?: number;
  }>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.gradeScale.deleteMany({ where: { organizationId } });

    return tx.gradeScale.createMany({
      data: scales.map((s) => ({
        organizationId,
        name: s.name,
        minPercentage: s.minPercentage,
        maxPercentage: s.maxPercentage,
        grade: s.grade,
        gradePoint: s.gradePoint,
      })),
    });
  });
}

/* ══════════════════════════════════════════════════════════
   AUTO-GRADE ASSIGNMENT
   ══════════════════════════════════════════════════════════ */

export async function applyGrades(examId: string, organizationId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.organizationId !== organizationId) {
    throw new ExamError("Exam not found");
  }
  if (exam.status !== "ACTIVE" && exam.status !== "LOCKED") {
    throw new ExamError("Grades can only be applied to ACTIVE or LOCKED exams");
  }

  const tabulation = await getTabulation(examId, organizationId);

  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of tabulation) {
      if (row.grade) {
        for (const subj of row.subjects) {
          const subjectPct =
            subj.totalMarks > 0
              ? Math.round((subj.obtainedMarks / subj.totalMarks) * 10000) / 100
              : 0;

          const gradeScales = await tx.gradeScale.findMany({
            where: { organizationId },
            orderBy: { minPercentage: "desc" },
          });

          const subjectGrade = resolveGrade(subjectPct, gradeScales);

          await tx.studentExamResult.updateMany({
            where: {
              examSubjectId: subj.examSubjectId,
              enrollmentId: row.enrollmentId,
            },
            data: { grade: subjectGrade },
          });
          updated++;
        }
      }
    }
  });

  return { updated };
}

/* ══════════════════════════════════════════════════════════
   RESULT SHEET (per student)
   ══════════════════════════════════════════════════════════ */

export async function getStudentResultCard(
  enrollmentId: string,
  organizationId: string,
  academicYearId?: string,
) {
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { fullName: true, admissionNo: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
      academicYear: { select: { name: true } },
    },
  });

  if (!enrollment || enrollment.organizationId !== organizationId) {
    throw new ExamError("Enrollment not found");
  }

  const yearFilter = academicYearId ?? enrollment.academicYearId;

  const exams = await prisma.exam.findMany({
    where: {
      organizationId,
      academicYearId: yearFilter,
      classId: enrollment.classId,
      OR: [
        { sectionId: enrollment.sectionId },
        { sectionId: null },
      ],
      status: { in: ["LOCKED", "PUBLISHED"] },
    },
    orderBy: { startDate: "asc" },
    include: {
      examSubjects: {
        include: { subject: { select: { name: true, code: true } } },
        orderBy: { subject: { name: "asc" } },
      },
    },
  });

  const results = await prisma.studentExamResult.findMany({
    where: {
      enrollmentId,
      examId: { in: exams.map((e) => e.id) },
    },
  });

  const resultMap = new Map(
    results.map((r) => [`${r.examId}-${r.examSubjectId}`, r]),
  );

  const examResults = exams.map((exam) => {
    const subjects = exam.examSubjects.map((es) => {
      const key = `${exam.id}-${es.id}`;
      const r = resultMap.get(key);
      return {
        subjectName: es.subject.name,
        subjectCode: es.subject.code,
        totalMarks: Number(es.totalMarks),
        passingMarks: Number(es.passingMarks),
        obtainedMarks: r ? Number(r.obtainedMarks) : null,
        grade: r?.grade ?? null,
        passed: r ? Number(r.obtainedMarks) >= Number(es.passingMarks) : null,
      };
    });

    const totalObtained = subjects.reduce(
      (sum, s) => sum + (s.obtainedMarks ?? 0),
      0,
    );
    const totalPossible = subjects.reduce((sum, s) => sum + s.totalMarks, 0);
    const percentage =
      totalPossible > 0
        ? Math.round((totalObtained / totalPossible) * 10000) / 100
        : 0;

    return {
      examId: exam.id,
      examName: exam.name,
      examType: exam.examType,
      startDate: exam.startDate,
      endDate: exam.endDate,
      subjects,
      totalObtained,
      totalPossible,
      percentage,
    };
  });

  return {
    student: {
      id: enrollment.studentId,
      name: enrollment.student.fullName,
      admissionNo: enrollment.student.admissionNo,
      className: enrollment.class.name,
      sectionName: enrollment.section?.name ?? null,
      academicYear: enrollment.academicYear.name,
      rollNumber: enrollment.rollNumber,
    },
    exams: examResults,
  };
}

/* ── Helpers ────────────────────────────────────────────── */

interface GradeRow {
  minPercentage: unknown;
  maxPercentage: unknown;
  grade: string;
}

function resolveGrade(percentage: number, scales: GradeRow[]): string | null {
  for (const scale of scales) {
    if (
      percentage >= Number(scale.minPercentage) &&
      percentage <= Number(scale.maxPercentage)
    ) {
      return scale.grade;
    }
  }
  return null;
}

/* ── Custom Error ───────────────────────────────────────── */

export class ExamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExamError";
  }
}
