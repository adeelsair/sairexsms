import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@/lib/generated/prisma";
import { assertYearOpen } from "./academic-year.service";
import { emitActionUpdated } from "@/lib/events/action-events";
import { syncDailyAttendanceCount } from "@/lib/performance/organization-daily-stats.service";

/* ── Types ──────────────────────────────────────────────── */

export interface AttendanceEntry {
  enrollmentId: string;
  studentId: number;
  status: AttendanceStatus;
  remarks?: string;
}

export interface BulkMarkInput {
  organizationId: string;
  academicYearId: string;
  campusId: number;
  classId: string;
  sectionId: string;
  date: Date;
  markedById?: number;
  entries: AttendanceEntry[];
}

export interface UpdateAttendanceInput {
  attendanceId: string;
  organizationId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface AttendanceScopeFilter {
  organizationId: string;
  campusId?: number;
  unitPath?: string | null;
}

export interface AttendanceQueryParams {
  scope: AttendanceScopeFilter;
  academicYearId: string;
  sectionId?: string;
  classId?: string;
  studentId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  date?: Date;
  status?: AttendanceStatus;
  limit?: number;
  offset?: number;
}

export interface AttendanceRow {
  id: string;
  enrollmentId: string;
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNumber: string | null;
  date: Date;
  status: AttendanceStatus;
  remarks: string | null;
}

export interface DaySummary {
  date: Date;
  sectionId: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  halfDay: number;
}

export interface StudentAttendanceSummary {
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNumber: string | null;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  halfDay: number;
  percentage: number;
}

/* ── Bulk Mark Attendance ───────────────────────────────── */

const MARK_BATCH = 500;

export async function bulkMarkAttendance(input: BulkMarkInput) {
  const {
    organizationId, academicYearId, campusId, classId, sectionId,
    date, markedById, entries,
  } = input;

  if (entries.length === 0) {
    throw new AttendanceError("No attendance entries provided");
  }

  await assertYearOpen(academicYearId);
  await assertDateWithinAcademicYear(organizationId, academicYearId, date);

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { organizationId: true, classId: true, campusId: true, academicYearId: true, status: true },
  });

  if (!section || section.organizationId !== organizationId) {
    throw new AttendanceError("Section not found");
  }
  if (section.status !== "ACTIVE") {
    throw new AttendanceError("Section is not active");
  }
  if (section.classId !== classId || section.campusId !== campusId || section.academicYearId !== academicYearId) {
    throw new AttendanceError("Section does not match the specified class, campus, or academic year");
  }

  const enrollmentIds = entries.map((e) => e.enrollmentId);
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      id: { in: enrollmentIds },
      organizationId,
      academicYearId,
      sectionId,
      status: "ACTIVE",
    },
    select: { id: true, studentId: true },
  });

  const validEnrollmentMap = new Map(enrollments.map((e) => [e.id, e]));
  const invalidIds = enrollmentIds.filter((id) => !validEnrollmentMap.has(id));

  if (invalidIds.length > 0) {
    throw new AttendanceError(
      `${invalidIds.length} enrollment(s) are invalid, inactive, or not in this section`,
    );
  }

  const normalizedDate = normalizeDate(date);
  let created = 0;
  let updated = 0;

  for (let i = 0; i < entries.length; i += MARK_BATCH) {
    const batch = entries.slice(i, i + MARK_BATCH);
    const batchEnrollmentIds = batch.map((entry) => entry.enrollmentId);

    const existingRows = await prisma.attendance.findMany({
      where: {
        organizationId,
        sectionId,
        date: normalizedDate,
        enrollmentId: { in: batchEnrollmentIds },
      },
      select: { id: true, enrollmentId: true },
    });
    const existingByEnrollmentId = new Map(
      existingRows.map((row) => [row.enrollmentId, row.id]),
    );

    const createRows: Array<{
      organizationId: string;
      academicYearId: string;
      campusId: number;
      classId: string;
      sectionId: string;
      enrollmentId: string;
      studentId: number;
      date: Date;
      status: AttendanceStatus;
      remarks?: string;
      markedById?: number;
    }> = [];
    const updateRows: Array<{
      id: string;
      status: AttendanceStatus;
      remarks?: string;
    }> = [];

    for (const entry of batch) {
      const existingId = existingByEnrollmentId.get(entry.enrollmentId);
      if (existingId) {
        updateRows.push({
          id: existingId,
          status: entry.status,
          remarks: entry.remarks,
        });
      } else {
        const enrollment = validEnrollmentMap.get(entry.enrollmentId)!;
        createRows.push({
          organizationId,
          academicYearId,
          campusId,
          classId,
          sectionId,
          enrollmentId: entry.enrollmentId,
          studentId: enrollment.studentId,
          date: normalizedDate,
          status: entry.status,
          remarks: entry.remarks,
          markedById,
        });
      }
    }

    if (createRows.length > 0) {
      const createResult = await prisma.attendance.createMany({
        data: createRows,
        skipDuplicates: true,
      });
      created += createResult.count;
    }

    if (updateRows.length > 0) {
      await Promise.all(
        updateRows.map((row) =>
          prisma.attendance.update({
            where: { id: row.id },
            data: {
              status: row.status,
              remarks: row.remarks,
              markedById,
            },
          }),
        ),
      );
      updated += updateRows.length;
    }
  }

  emitActionUpdated({
    orgId: organizationId,
    type: "ABSENT_FOLLOWUP",
  });
  await syncDailyAttendanceCount({
    organizationId,
    date: normalizedDate,
  });

  return { created, updated, total: entries.length };
}

/* ── Update Single Record ───────────────────────────────── */

export async function updateAttendance(input: UpdateAttendanceInput) {
  const record = await prisma.attendance.findUnique({
    where: { id: input.attendanceId },
  });

  if (!record || record.organizationId !== input.organizationId) {
    throw new AttendanceError("Attendance record not found");
  }

  await assertYearOpen(record.academicYearId);

  const updated = await prisma.attendance.update({
    where: { id: input.attendanceId },
    data: {
      status: input.status,
      remarks: input.remarks,
    },
  });

  emitActionUpdated({
    orgId: input.organizationId,
    type: "ABSENT_FOLLOWUP",
  });
  await syncDailyAttendanceCount({
    organizationId: input.organizationId,
    date: record.date,
  });

  return updated;
}

/* ── Get Section Attendance for Date ────────────────────── */

export async function getSectionAttendanceByDate(
  scope: AttendanceScopeFilter,
  sectionId: string,
  date: Date,
): Promise<AttendanceRow[]> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: { academicYearId: true, organizationId: true },
  });

  if (!section || section.organizationId !== scope.organizationId) {
    throw new AttendanceError("Section not found");
  }

  await assertDateWithinAcademicYear(scope.organizationId, section.academicYearId, date);

  const normalizedDate = normalizeDate(date);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      organizationId: scope.organizationId,
      sectionId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      studentId: true,
      rollNumber: true,
      student: { select: { fullName: true, admissionNo: true } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { fullName: "asc" } }],
  });

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      sectionId,
      date: normalizedDate,
      organizationId: scope.organizationId,
    },
  });

  const attendanceMap = new Map(
    attendanceRecords.map((a) => [a.enrollmentId, a]),
  );

  return enrollments.map((e) => {
    const record = attendanceMap.get(e.id);
    return {
      id: record?.id ?? "",
      enrollmentId: e.id,
      studentId: e.studentId,
      studentName: e.student.fullName,
      admissionNo: e.student.admissionNo,
      rollNumber: e.rollNumber,
      date: normalizedDate,
      status: record?.status ?? ("UNMARKED" as AttendanceStatus),
      remarks: record?.remarks ?? null,
    };
  });
}

/* ── Query Attendance Records ───────────────────────────── */

export async function queryAttendance(params: AttendanceQueryParams): Promise<{
  rows: AttendanceRow[];
  total: number;
}> {
  const { scope, academicYearId, limit = 50, offset = 0 } = params;

  const where: Record<string, unknown> = {
    organizationId: scope.organizationId,
    academicYearId,
  };

  if (scope.campusId) {
    where.campusId = scope.campusId;
  } else if (scope.unitPath) {
    where.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  if (params.sectionId) where.sectionId = params.sectionId;
  if (params.classId) where.classId = params.classId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.status) where.status = params.status;

  if (params.date) {
    where.date = normalizeDate(params.date);
  } else if (params.dateFrom || params.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (params.dateFrom) dateFilter.gte = normalizeDate(params.dateFrom);
    if (params.dateTo) dateFilter.lte = normalizeDate(params.dateTo);
    where.date = dateFilter;
  }

  const [rows, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      orderBy: [{ date: "desc" }, { student: { fullName: "asc" } }],
      skip: offset,
      take: limit,
      include: {
        student: { select: { fullName: true, admissionNo: true } },
        enrollment: { select: { rollNumber: true } },
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      enrollmentId: r.enrollmentId,
      studentId: r.studentId,
      studentName: r.student.fullName,
      admissionNo: r.student.admissionNo,
      rollNumber: r.enrollment.rollNumber,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
    })),
    total,
  };
}

/* ── Day Summary (Section) ──────────────────────────────── */

export async function getDaySummary(
  scope: AttendanceScopeFilter,
  sectionId: string,
  date: Date,
): Promise<DaySummary> {
  const normalizedDate = normalizeDate(date);

  const results = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      organizationId: scope.organizationId,
      sectionId,
      date: normalizedDate,
    },
    _count: true,
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of results) {
    counts[row.status] = row._count;
    total += row._count;
  }

  return {
    date: normalizedDate,
    sectionId,
    total,
    present: counts["PRESENT"] ?? 0,
    absent: counts["ABSENT"] ?? 0,
    late: counts["LATE"] ?? 0,
    leave: counts["LEAVE"] ?? 0,
    halfDay: counts["HALF_DAY"] ?? 0,
  };
}

/* ── Student Attendance Summary (Period) ────────────────── */

export async function getStudentAttendanceSummary(
  scope: AttendanceScopeFilter,
  academicYearId: string,
  options: {
    classId?: string;
    sectionId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {},
): Promise<StudentAttendanceSummary[]> {
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

  if (options.dateFrom || options.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (options.dateFrom) dateFilter.gte = normalizeDate(options.dateFrom);
    if (options.dateTo) dateFilter.lte = normalizeDate(options.dateTo);
    where.date = dateFilter;
  }

  const grouped = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where,
    _count: true,
  });

  const studentMap = new Map<number, Record<string, number>>();
  for (const row of grouped) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, {});
    }
    studentMap.get(row.studentId)![row.status] = row._count;
  }

  if (studentMap.size === 0) return [];

  const students = await prisma.studentEnrollment.findMany({
    where: {
      organizationId: scope.organizationId,
      academicYearId,
      studentId: { in: Array.from(studentMap.keys()) },
    },
    select: {
      studentId: true,
      rollNumber: true,
      student: { select: { fullName: true, admissionNo: true } },
    },
  });

  const studentInfoMap = new Map(students.map((s) => [s.studentId, s]));

  const summaries: StudentAttendanceSummary[] = [];

  for (const [studentId, counts] of studentMap) {
    const info = studentInfoMap.get(studentId);
    const present = counts["PRESENT"] ?? 0;
    const absent = counts["ABSENT"] ?? 0;
    const late = counts["LATE"] ?? 0;
    const leave = counts["LEAVE"] ?? 0;
    const halfDay = counts["HALF_DAY"] ?? 0;
    const totalDays = present + absent + late + leave + halfDay;

    const effectivePresent = present + late + halfDay * 0.5;
    const percentage = totalDays > 0 ? Math.round((effectivePresent / totalDays) * 10000) / 100 : 0;

    summaries.push({
      studentId,
      studentName: info?.student.fullName ?? "Unknown",
      admissionNo: info?.student.admissionNo ?? "",
      rollNumber: info?.rollNumber ?? null,
      totalDays,
      present,
      absent,
      late,
      leave,
      halfDay,
      percentage,
    });
  }

  summaries.sort((a, b) => a.percentage - b.percentage);
  return summaries;
}

/* ── Campus / Class Attendance Overview ──────────────────── */

export interface ClassAttendanceOverview {
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  totalMarked: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  halfDay: number;
  percentage: number;
}

export async function getAttendanceOverview(
  scope: AttendanceScopeFilter,
  academicYearId: string,
  date: Date,
): Promise<ClassAttendanceOverview[]> {
  const normalizedDate = normalizeDate(date);

  const campusFilter: Record<string, unknown> = {};
  if (scope.campusId) campusFilter.campusId = scope.campusId;
  else if (scope.unitPath) {
    campusFilter.campus = { fullUnitPath: { startsWith: scope.unitPath } };
  }

  const grouped = await prisma.attendance.groupBy({
    by: ["classId", "sectionId", "status"],
    where: {
      organizationId: scope.organizationId,
      academicYearId,
      date: normalizedDate,
      ...campusFilter,
    },
    _count: true,
  });

  const sectionMap = new Map<string, Record<string, number>>();
  const classSectionMapping = new Map<string, string>();

  for (const row of grouped) {
    if (!sectionMap.has(row.sectionId)) {
      sectionMap.set(row.sectionId, {});
      classSectionMapping.set(row.sectionId, row.classId);
    }
    sectionMap.get(row.sectionId)![row.status] = row._count;
  }

  if (sectionMap.size === 0) return [];

  const [sections, classes] = await prisma.$transaction([
    prisma.section.findMany({
      where: { id: { in: Array.from(sectionMap.keys()) } },
      select: { id: true, name: true, classId: true },
    }),
    prisma.class.findMany({
      where: { id: { in: Array.from(new Set(classSectionMapping.values())) } },
      select: { id: true, name: true, displayOrder: true },
    }),
  ]);

  const sectionInfo = new Map(sections.map((s) => [s.id, s]));
  const classInfo = new Map(classes.map((c) => [c.id, c]));

  const results: ClassAttendanceOverview[] = [];

  for (const [sectionId, counts] of sectionMap) {
    const sec = sectionInfo.get(sectionId);
    const cls = classInfo.get(classSectionMapping.get(sectionId) ?? "");

    const present = counts["PRESENT"] ?? 0;
    const absent = counts["ABSENT"] ?? 0;
    const late = counts["LATE"] ?? 0;
    const leave = counts["LEAVE"] ?? 0;
    const halfDay = counts["HALF_DAY"] ?? 0;
    const totalMarked = present + absent + late + leave + halfDay;

    const effectivePresent = present + late + halfDay * 0.5;
    const percentage = totalMarked > 0 ? Math.round((effectivePresent / totalMarked) * 10000) / 100 : 0;

    results.push({
      classId: cls?.id ?? "",
      className: cls?.name ?? "Unknown",
      sectionId,
      sectionName: sec?.name ?? "Unknown",
      totalMarked,
      present,
      absent,
      late,
      leave,
      halfDay,
      percentage,
    });
  }

  results.sort((a, b) => {
    const orderA = classInfo.get(a.classId)?.displayOrder ?? 999;
    const orderB = classInfo.get(b.classId)?.displayOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.sectionName.localeCompare(b.sectionName);
  });

  return results;
}

/* ── Helpers ────────────────────────────────────────────── */

function normalizeDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function assertDateWithinAcademicYear(
  organizationId: string,
  academicYearId: string,
  date: Date,
) {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { organizationId: true, name: true, startDate: true, endDate: true },
  });

  if (!academicYear || academicYear.organizationId !== organizationId) {
    throw new AttendanceError("Academic year not found");
  }

  const normalizedDate = normalizeDate(date);
  const startDate = normalizeDate(academicYear.startDate);
  const endDate = normalizeDate(academicYear.endDate);

  if (normalizedDate < startDate || normalizedDate > endDate) {
    throw new AttendanceError(
      `Date must be within the academic year "${academicYear.name}" range`,
    );
  }
}

/* ── Custom Error ───────────────────────────────────────── */

export class AttendanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceError";
  }
}
