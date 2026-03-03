import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  getClassById,
  updateClass,
  archiveClass,
  ClassSectionError,
} from "@/lib/academic/class-section.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/academic/classes/:id
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await context.params;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await getClassById(id, orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ClassSectionError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch class";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/academic/classes/:id
 *
 * Body: { name?, code?, displayOrder? }
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
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await updateClass(id, orgId, {
      name: body.name as string | undefined,
      code: body.code as string | undefined,
      displayOrder: body.displayOrder as number | undefined,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof ClassSectionError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "A class with this name already exists for this campus and academic year" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Update failed";
    console.error("Class update error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/academic/classes/:id  (soft archive)
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
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    await archiveClass(id, orgId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof ClassSectionError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Delete failed";
    console.error("Class archive error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
