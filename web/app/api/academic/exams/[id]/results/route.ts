import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  bulkEnterResults,
  updateSingleResult,
  ExamError,
} from "@/lib/academic/exam.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/academic/exams/:id/results
 *
 * Bulk enter results.
 *
 * Body:
 * {
 *   academicYearId,
 *   entries: [{ enrollmentId, studentId, examSubjectId, obtainedMarks, remarks? }, ...]
 * }
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(
    guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "TEACHER",
  );
  if (roleCheck) return roleCheck;

  try {
    const { id: examId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const academicYearId = body.academicYearId as string;
    const entries = body.entries as Array<{
      enrollmentId: string;
      studentId: number;
      examSubjectId: string;
      obtainedMarks: number;
      remarks?: string;
    }>;

    if (!academicYearId || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "academicYearId and non-empty entries array are required" },
        { status: 400 },
      );
    }

    const data = await bulkEnterResults({
      organizationId: orgId,
      academicYearId,
      examId,
      entries,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ExamError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to enter results";
    console.error("Result entry error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/academic/exams/:id/results
 *
 * Update single result.
 *
 * Body: { resultId, obtainedMarks?, grade?, remarks? }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(
    guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN", "TEACHER",
  );
  if (roleCheck) return roleCheck;

  try {
    await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const resultId = body.resultId as string;
    if (!resultId) {
      return NextResponse.json({ ok: false, error: "resultId is required" }, { status: 400 });
    }

    const data = await updateSingleResult(resultId, orgId, {
      obtainedMarks: body.obtainedMarks as number | undefined,
      grade: body.grade as string | undefined,
      remarks: body.remarks as string | undefined,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ExamError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update result";
    console.error("Result update error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
