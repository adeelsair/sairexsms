import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getCampusHealthScores,
  refreshCampusHealthScores,
} from "@/lib/governance";

/**
 * GET  /api/governance/health-scores — Fetch materialized health scores
 * POST /api/governance/health-scores — Trigger a refresh (ORG_ADMIN)
 */

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const scores = await getCampusHealthScores(guard.organizationId!);
    return NextResponse.json(scores);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch health scores" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const count = await refreshCampusHealthScores(guard.organizationId!);
    return NextResponse.json({
      success: true,
      campusesRefreshed: count,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to refresh health scores" },
      { status: 500 },
    );
  }
}
