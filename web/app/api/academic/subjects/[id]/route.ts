import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import { updateSubject, archiveSubject, ExamError } from "@/lib/academic/exam.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/academic/subjects/:id
 *
 * Body: { name?, code? }
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

    const data = await updateSubject(id, orgId, {
      name: body.name as string | undefined,
      code: body.code as string | undefined,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ExamError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" && error !== null && "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "A subject with this name already exists for this class and year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/academic/subjects/:id  (soft archive)
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const { id } = await context.params;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    await archiveSubject(id, orgId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof ExamError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
