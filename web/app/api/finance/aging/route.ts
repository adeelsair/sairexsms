import { NextResponse } from "next/server";
import { requireAuth, isSuperAdmin } from "@/lib/auth-guard";
import {
  getDashboardMetrics,
  getCampusAgingSummary,
  getCollectionTrend,
  type FinanceScope,
} from "@/lib/finance/defaulter.service";

/**
 * GET /api/finance/aging?view=dashboard|campuses|trend&campusId=1&months=6
 *
 * view=dashboard  → aggregate metrics + risk level
 * view=campuses   → per-campus aging breakdown
 * view=trend      → collection efficiency trend (last N months)
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

    const scope: FinanceScope = { organizationId: orgId };

    if (!isSuperAdmin(guard) && guard.role !== "ORG_ADMIN" && guard.unitPath) {
      scope.unitPath = guard.unitPath;
    }

    const campusIdParam = searchParams.get("campusId");
    if (campusIdParam) {
      scope.campusId = parseInt(campusIdParam, 10);
    } else if (guard.campusId && guard.role === "CAMPUS_ADMIN") {
      scope.campusId = guard.campusId;
    }

    const view = searchParams.get("view") ?? "dashboard";

    switch (view) {
      case "dashboard": {
        const metrics = await getDashboardMetrics(scope);
        return NextResponse.json({ ok: true, data: metrics });
      }

      case "campuses": {
        const campuses = await getCampusAgingSummary(scope);
        return NextResponse.json({ ok: true, data: campuses });
      }

      case "trend": {
        const months = Math.min(parseInt(searchParams.get("months") ?? "6", 10) || 6, 12);
        const trend = await getCollectionTrend(scope, months);
        return NextResponse.json({ ok: true, data: trend });
      }

      default:
        return NextResponse.json(
          { ok: false, error: "Invalid view. Must be: dashboard, campuses, or trend" },
          { status: 400 },
        );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch aging data";
    console.error("Aging analytics error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
