import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import type { ExamStatus } from "@/lib/generated/prisma";
import {
  getExam,
  updateExam,
  changeExamStatus,
  addExamSubject,
  removeExamSubject,
  getTabulation,
  applyGrades,
  getStudentResultCard,
  ExamError,
} from "@/lib/academic/exam.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/academic/exams/:id
 *
 * Query params:
 *   view=tabulation — returns full merit/tabulation sheet
 *   view=resultCard&enrollmentId=... — returns student result card
 *   (default) — returns exam detail with subjects
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const view = searchParams.get("view");

    if (view === "tabulation") {
      const data = await getTabulation(id, orgId);
      return NextResponse.json({ ok: true, data });
    }

    if (view === "resultCard") {
      const enrollmentId = searchParams.get("enrollmentId");
      if (!enrollmentId) {
        return NextResponse.json(
          { ok: false, error: "enrollmentId is required for result card view" },
          { status: 400 },
        );
      }
      const data = await getStudentResultCard(enrollmentId, orgId);
      return NextResponse.json({ ok: true, data });
    }

    const data = await getExam(id, orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ExamError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch exam";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/academic/exams/:id
 *
 * Actions:
 *   { action: "update", name?, startDate?, endDate? }           — DRAFT only
 *   { action: "status", status: ExamStatus }                     — lifecycle transitions
 *   { action: "addSubject", subjectId, totalMarks, passingMarks } — DRAFT only
 *   { action: "removeSubject", examSubjectId }                   — DRAFT only
 *   { action: "applyGrades" }                                    — ACTIVE/LOCKED
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const action = body.action as string;
    if (!action) {
      return NextResponse.json({ ok: false, error: "action is required" }, { status: 400 });
    }

    switch (action) {
      case "update": {
        const data = await updateExam(id, orgId, {
          name: body.name as string | undefined,
          startDate: body.startDate ? new Date(body.startDate as string) : undefined,
          endDate: body.endDate ? new Date(body.endDate as string) : undefined,
        });
        return NextResponse.json({ ok: true, data });
      }

      case "status": {
        const targetStatus = body.status as ExamStatus;
        if (!targetStatus) {
          return NextResponse.json({ ok: false, error: "status is required" }, { status: 400 });
        }

        if (targetStatus === "PUBLISHED" || targetStatus === "LOCKED") {
          const adminCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
          if (adminCheck) return adminCheck;
        }

        const data = await changeExamStatus(id, orgId, targetStatus);
        return NextResponse.json({ ok: true, data });
      }

      case "addSubject": {
        const subjectId = body.subjectId as string;
        const totalMarks = body.totalMarks as number;
        const passingMarks = body.passingMarks as number;

        if (!subjectId || totalMarks === undefined || passingMarks === undefined) {
          return NextResponse.json(
            { ok: false, error: "subjectId, totalMarks, and passingMarks are required" },
            { status: 400 },
          );
        }

        const data = await addExamSubject(id, orgId, subjectId, totalMarks, passingMarks);
        return NextResponse.json({ ok: true, data });
      }

      case "removeSubject": {
        const examSubjectId = body.examSubjectId as string;
        if (!examSubjectId) {
          return NextResponse.json(
            { ok: false, error: "examSubjectId is required" },
            { status: 400 },
          );
        }

        await removeExamSubject(examSubjectId, orgId);
        return NextResponse.json({ ok: true });
      }

      case "applyGrades": {
        const data = await applyGrades(id, orgId);
        return NextResponse.json({ ok: true, data });
      }

      default:
        return NextResponse.json(
          { ok: false, error: "Invalid action. Must be: update, status, addSubject, removeSubject, or applyGrades" },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    if (error instanceof ExamError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" && error !== null && "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "Duplicate subject assignment for this exam" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Exam operation error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
