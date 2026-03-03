import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  listAcademicYears,
  createAcademicYear,
  activateAcademicYear,
  closeAcademicYear,
  archiveAcademicYear,
  updateAcademicYear,
  AcademicYearError,
} from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/years
 *
 * List all academic years for the organization.
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

    const years = await listAcademicYears(orgId);
    return NextResponse.json({ ok: true, data: years });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch academic years";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/years
 *
 * Create a new academic year (DRAFT) or perform lifecycle actions.
 *
 * Body for create: { name, startDate, endDate }
 * Body for action: { action: "activate" | "close" | "archive", yearId }
 * Body for update: { action: "update", yearId, name?, startDate?, endDate? }
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const action = body.action as string | undefined;

    if (!action) {
      const name = body.name as string;
      const startDate = body.startDate as string;
      const endDate = body.endDate as string;

      if (!name || !startDate || !endDate) {
        return NextResponse.json(
          { ok: false, error: "name, startDate, and endDate are required" },
          { status: 400 },
        );
      }

      const year = await createAcademicYear({
        organizationId: orgId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return NextResponse.json({ ok: true, data: year }, { status: 201 });
    }

    const yearId = body.yearId as string;
    if (!yearId) {
      return NextResponse.json({ ok: false, error: "yearId is required for actions" }, { status: 400 });
    }

    switch (action) {
      case "activate": {
        const year = await activateAcademicYear(yearId, orgId);
        return NextResponse.json({ ok: true, data: year });
      }
      case "close": {
        const year = await closeAcademicYear(yearId, orgId);
        return NextResponse.json({ ok: true, data: year });
      }
      case "archive": {
        const year = await archiveAcademicYear(yearId, orgId);
        return NextResponse.json({ ok: true, data: year });
      }
      case "update": {
        const year = await updateAcademicYear(yearId, orgId, {
          name: body.name as string | undefined,
          startDate: body.startDate ? new Date(body.startDate as string) : undefined,
          endDate: body.endDate ? new Date(body.endDate as string) : undefined,
        });
        return NextResponse.json({ ok: true, data: year });
      }
      default:
        return NextResponse.json(
          { ok: false, error: "Invalid action. Must be: activate, close, archive, or update" },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    if (error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "An academic year with this name already exists" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Academic year error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
