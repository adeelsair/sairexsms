import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import type { ExamType, ExamStatus } from "@/lib/generated/prisma";
import {
  createExam,
  listExams,
  listGradeScales,
  upsertGradeScales,
  ExamError,
} from "@/lib/academic/exam.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/exams?academicYearId=...
 *
 * Query params: classId, sectionId, status
 * Special: ?view=gradeScales — returns organization grade scales
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    if (searchParams.get("view") === "gradeScales") {
      const data = await listGradeScales(orgId);
      return NextResponse.json({ ok: true, data });
    }

    const academicYearId = searchParams.get("academicYearId");
    if (!academicYearId) {
      return NextResponse.json({ ok: false, error: "academicYearId is required" }, { status: 400 });
    }

    const data = await listExams(
      {
        organizationId: orgId,
        campusId: searchParams.get("campusId") ? Number(searchParams.get("campusId")) : guard.campusId ?? undefined,
        unitPath: guard.unitPath,
      },
      academicYearId,
      {
        classId: searchParams.get("classId") ?? undefined,
        sectionId: searchParams.get("sectionId") ?? undefined,
        status: (searchParams.get("status") as ExamStatus) ?? undefined,
      },
    );

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch exams";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/exams
 *
 * Create exam:
 *   { academicYearId, campusId, classId, sectionId?, name, examType,
 *     startDate, endDate, subjects: [{ subjectId, totalMarks, passingMarks }] }
 *
 * Upsert grade scales:
 *   { action: "gradeScales", scales: [{ name, minPercentage, maxPercentage, grade, gradePoint? }] }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    if (body.action === "gradeScales") {
      const adminCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
      if (adminCheck) return adminCheck;

      const scales = body.scales as Array<{
        name: string;
        minPercentage: number;
        maxPercentage: number;
        grade: string;
        gradePoint?: number;
      }>;

      if (!Array.isArray(scales) || scales.length === 0) {
        return NextResponse.json(
          { ok: false, error: "scales array is required" },
          { status: 400 },
        );
      }

      const data = await upsertGradeScales(orgId, scales);
      return NextResponse.json({ ok: true, data });
    }

    const academicYearId = body.academicYearId as string;
    const campusId = body.campusId as number;
    const classId = body.classId as string;
    const name = body.name as string;
    const examType = body.examType as ExamType;
    const startDate = body.startDate as string;
    const endDate = body.endDate as string;
    const subjects = body.subjects as Array<{
      subjectId: string;
      totalMarks: number;
      passingMarks: number;
    }>;

    if (!academicYearId || !campusId || !classId || !name || !examType || !startDate || !endDate) {
      return NextResponse.json(
        { ok: false, error: "academicYearId, campusId, classId, name, examType, startDate, endDate are required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json(
        { ok: false, error: "subjects array with at least one entry is required" },
        { status: 400 },
      );
    }

    const data = await createExam({
      organizationId: orgId,
      academicYearId,
      campusId,
      classId,
      sectionId: body.sectionId as string | undefined,
      name,
      examType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      subjects,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ExamError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" && error !== null && "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "Duplicate exam subject configuration detected" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Exam creation error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
