import { getAttendanceRisks } from "@/lib/insights/attendance-risk.service";
import { getPredictedDefaulters } from "@/lib/insights/predictive-fee.service";
import { prisma } from "@/lib/prisma";

const DEFAULT_STABILITY_THRESHOLD = Number(
  process.env.STUDENT_STABILITY_THRESHOLD ?? 75,
);

type StudentStabilityRow = {
  studentId: number;
  name: string;
  admissionNo?: string;
  grade?: string;
  className?: string;
  sectionName?: string;
  feeRisk: number;
  attendanceRisk: number;
  stabilityScore: number;
};

type Input = {
  organizationId: string;
  campusId?: number;
  stabilityThreshold?: number;
};

export async function getStudentStabilityOverview(input: Input) {
  const stabilityThreshold = Number.isFinite(input.stabilityThreshold ?? NaN)
    ? Number(input.stabilityThreshold)
    : DEFAULT_STABILITY_THRESHOLD;

  const [feeRisks, attendanceRisks] = await Promise.all([
    getPredictedDefaulters({
      organizationId: input.organizationId,
      campusId: input.campusId,
    }),
    getAttendanceRisks({
      organizationId: input.organizationId,
      campusId: input.campusId,
    }),
  ]);

  const combinedMap = new Map<number, StudentStabilityRow>();

  for (const student of feeRisks.students) {
    combinedMap.set(student.studentId, {
      studentId: student.studentId,
      name: student.name,
      admissionNo: student.admissionNo,
      grade: student.grade,
      feeRisk: student.riskScore,
      attendanceRisk: 0,
      stabilityScore: 100,
    });
  }

  for (const student of attendanceRisks.students) {
    const existing = combinedMap.get(student.studentId);
    if (existing) {
      existing.attendanceRisk = student.riskScore;
      existing.className = student.className;
      existing.sectionName = student.sectionName;
    } else {
      combinedMap.set(student.studentId, {
        studentId: student.studentId,
        name: student.name,
        className: student.className,
        sectionName: student.sectionName,
        feeRisk: 0,
        attendanceRisk: student.riskScore,
        stabilityScore: 100,
      });
    }
  }

  const missingAcademicContextIds = Array.from(combinedMap.values())
    .filter((row) => !row.className || !row.sectionName)
    .map((row) => row.studentId);

  if (missingAcademicContextIds.length) {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        organizationId: input.organizationId,
        studentId: { in: missingAcademicContextIds },
        status: "ACTIVE",
      },
      select: {
        studentId: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    for (const enrollment of enrollments) {
      const row = combinedMap.get(enrollment.studentId);
      if (!row) continue;
      if (!row.className) row.className = enrollment.class.name;
      if (!row.sectionName) row.sectionName = enrollment.section?.name ?? "-";
    }
  }

  const students: StudentStabilityRow[] = [];
  for (const row of combinedMap.values()) {
    const stabilityRaw = 100 - (row.feeRisk * 0.6 + row.attendanceRisk * 0.4);
    row.stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityRaw)));

    if (row.stabilityScore <= stabilityThreshold) {
      students.push(row);
    }
  }

  students.sort((a, b) => a.stabilityScore - b.stabilityScore);

  return {
    count: students.length,
    threshold: stabilityThreshold,
    students,
  };
}
