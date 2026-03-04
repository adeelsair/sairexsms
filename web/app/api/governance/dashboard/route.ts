import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getChainKpis,
  getCampusComparison,
  detectLeakageAlerts,
} from "@/lib/governance";

/**
 * GET /api/governance/dashboard — Chain-wide KPIs, campus comparison, leakage alerts
 *
 * Query params:
 *   ?section=kpis          — Top-level KPIs only
 *   ?section=comparison    — Campus comparison table
 *   ?section=leakage       — Leakage alerts
 *   (no section)           — All three combined
 */

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  const orgId = guard.organizationId!;

  try {
    if (section === "kpis") {
      const kpis = await getChainKpis(orgId);
      return NextResponse.json(kpis);
    }

    if (section === "comparison") {
      const comparison = await getCampusComparison(orgId);
      return NextResponse.json(comparison);
    }

    if (section === "leakage") {
      const alerts = await detectLeakageAlerts(orgId);
      return NextResponse.json(alerts);
    }

    const [kpis, comparison, leakageAlerts] = await Promise.all([
      getChainKpis(orgId),
      getCampusComparison(orgId),
      detectLeakageAlerts(orgId),
    ]);

    return NextResponse.json({ kpis, comparison, leakageAlerts });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
