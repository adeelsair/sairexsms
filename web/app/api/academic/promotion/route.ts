import { NextResponse } from "next/server";
import { requireAuth, requireRole, isSuperAdmin } from "@/lib/auth-guard";
import {
  checkRolloverReadiness,
  rolloverStructure,
  runPromotion,
  listPromotionRuns,
  getPromotionRun,
  PromotionError,
} from "@/lib/academic/promotion.service";
import { AcademicYearError } from "@/lib/academic/academic-year.service";

/**
 * GET /api/academic/promotion
 *
 * Query params:
 *   view=readiness&academicYearId=... — readiness check
 *   view=run&fromYearId=...          — single promotion run detail
 *   (default)                        — list all promotion runs
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const { searchParams } = new URL(request.url);

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Organization context required" }, { status: 400 });
    }

    const view = searchParams.get("view");

    if (view === "readiness") {
      const academicYearId = searchParams.get("academicYearId");
      if (!academicYearId) {
        return NextResponse.json(
          { ok: false, error: "academicYearId is required for readiness check" },
          { status: 400 },
        );
      }

      const data = await checkRolloverReadiness(orgId, academicYearId);
      return NextResponse.json({ ok: true, data });
    }

    if (view === "run") {
      const fromYearId = searchParams.get("fromYearId");
      if (!fromYearId) {
        return NextResponse.json(
          { ok: false, error: "fromYearId is required" },
          { status: 400 },
        );
      }

      const data = await getPromotionRun(orgId, fromYearId);
      if (!data) {
        return NextResponse.json({ ok: false, error: "Promotion run not found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, data });
    }

    const data = await listPromotionRuns(orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch promotion data";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/academic/promotion
 *
 * Actions:
 *
 * 1. Rollover structure (Step 1):
 *    {
 *      action: "rollover",
 *      fromAcademicYearId,
 *      newYearName, newYearStartDate, newYearEndDate,
 *      cloneSubjects?: boolean
 *    }
 *
 * 2. Run promotion (Step 2):
 *    {
 *      action: "promote",
 *      fromAcademicYearId, toAcademicYearId,
 *      config: { passingPercentage, useAttendance, minAttendancePercentage }
 *    }
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

    const action = body.action as string;

    if (action === "rollover") {
      const fromAcademicYearId = body.fromAcademicYearId as string;
      const newYearName = body.newYearName as string;
      const newYearStartDate = body.newYearStartDate as string;
      const newYearEndDate = body.newYearEndDate as string;

      if (!fromAcademicYearId || !newYearName || !newYearStartDate || !newYearEndDate) {
        return NextResponse.json(
          { ok: false, error: "fromAcademicYearId, newYearName, newYearStartDate, newYearEndDate are required" },
          { status: 400 },
        );
      }

      const data = await rolloverStructure({
        organizationId: orgId,
        fromAcademicYearId,
        newYearName,
        newYearStartDate: new Date(newYearStartDate),
        newYearEndDate: new Date(newYearEndDate),
        cloneSubjects: body.cloneSubjects as boolean | undefined,
        userId: guard.id,
      });

      return NextResponse.json({ ok: true, data }, { status: 201 });
    }

    if (action === "promote") {
      const fromAcademicYearId = body.fromAcademicYearId as string;
      const toAcademicYearId = body.toAcademicYearId as string;
      const config = body.config as {
        passingPercentage: number;
        useAttendance: boolean;
        minAttendancePercentage: number;
      };

      if (!fromAcademicYearId || !toAcademicYearId || !config) {
        return NextResponse.json(
          { ok: false, error: "fromAcademicYearId, toAcademicYearId, and config are required" },
          { status: 400 },
        );
      }

      if (config.passingPercentage === undefined) {
        return NextResponse.json(
          { ok: false, error: "config.passingPercentage is required" },
          { status: 400 },
        );
      }

      const data = await runPromotion({
        organizationId: orgId,
        fromAcademicYearId,
        toAcademicYearId,
        config: {
          passingPercentage: config.passingPercentage,
          useAttendance: config.useAttendance ?? false,
          minAttendancePercentage: config.minAttendancePercentage ?? 75,
        },
        userId: guard.id,
      });

      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action. Must be: rollover or promote" },
      { status: 400 },
    );
  } catch (error: unknown) {
    if (error instanceof PromotionError || error instanceof AcademicYearError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const isPrismaUnique =
      typeof error === "object" && error !== null && "code" in error &&
      (error as { code: string }).code === "P2002";

    if (isPrismaUnique) {
      return NextResponse.json(
        { ok: false, error: "A promotion run or academic year with this configuration already exists" },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Operation failed";
    console.error("Promotion error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
