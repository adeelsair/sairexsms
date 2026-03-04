import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import {
  getAccessCoverage,
  type CoverageLevel,
} from "@/lib/analytics/access-coverage.service";

const VALID_LEVELS = new Set<CoverageLevel>([
  "ORG",
  "REGION",
  "SUBREGION",
  "ZONE",
  "CAMPUS",
]);

/**
 * GET /api/analytics/access-coverage?level=REGION&unitPath=R01
 *
 * Returns access coverage analytics grouped by the requested level.
 * Scoped — non-ORG_ADMIN users only see data within their unitPath.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const levelParam = (searchParams.get("level") ?? "REGION").toUpperCase();
    const unitPathParam = searchParams.get("unitPath") ?? null;

    if (!VALID_LEVELS.has(levelParam as CoverageLevel)) {
      return NextResponse.json(
        { ok: false, error: `Invalid level. Must be one of: ${[...VALID_LEVELS].join(", ")}` },
        { status: 400 },
      );
    }

    const level = levelParam as CoverageLevel;

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    let scopeUnitPath: string | null = unitPathParam;

    if (!isSuperAdmin(guard) && guard.role !== "ORG_ADMIN" && guard.unitPath) {
      if (scopeUnitPath && !scopeUnitPath.startsWith(guard.unitPath)) {
        return NextResponse.json(
          { ok: false, error: "Requested scope is outside your access" },
          { status: 403 },
        );
      }
      scopeUnitPath = scopeUnitPath ?? guard.unitPath;
    }

    const rows = await getAccessCoverage({
      organizationId: orgId,
      level,
      scopeUnitPath,
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to compute access coverage";
    console.error("Access coverage error:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
