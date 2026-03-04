import { NextResponse } from "next/server";
import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import {
  listPostingRuns,
  PostingError,
  runMonthlyPosting,
} from "@/lib/finance/fee-posting.service";
import { resolveOrganizationMode } from "@/lib/system/mode.service";

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const mode = await resolveOrganizationMode(orgId);
    if (mode.isSimple) {
      return NextResponse.json(
        { ok: false, error: "Monthly posting is available in Pro mode only" },
        { status: 403 },
      );
    }

    const data = await listPostingRuns(
      orgId,
      searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    );

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load posting runs";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN", "CAMPUS_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const mode = await resolveOrganizationMode(orgId);
    if (mode.isSimple) {
      return NextResponse.json(
        { ok: false, error: "Monthly posting is available in Pro mode only" },
        { status: 403 },
      );
    }

    const month = Number(body.month);
    const year = Number(body.year);
    const campusId =
      body.campusId != null
        ? Number(body.campusId)
        : (guard.campusId ?? undefined);

    const userId = guard.id;
    const academicYearId = body.academicYearId as string | undefined;

    if (!month || !year || month < 1 || month > 12) {
      return NextResponse.json(
        { ok: false, error: "Valid month (1-12) and year are required" },
        { status: 400 },
      );
    }

    const data = await runMonthlyPosting({
      organizationId: orgId,
      month,
      year,
      userId,
      campusId,
      academicYearId,
      dueDate: body.dueDate ? new Date(String(body.dueDate)) : undefined,
    });

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof PostingError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to start monthly posting";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

