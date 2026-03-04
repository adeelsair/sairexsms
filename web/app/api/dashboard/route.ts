import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
  getDashboardActions,
  getDashboardStats,
  getDashboardActivity,
} from "@/lib/adoption/dashboard.service";

/**
 * GET /api/dashboard
 *
 * Returns the complete dashboard payload for the authenticated user:
 *   - actions: role-aware action buttons
 *   - stats:   quick metrics (role-specific)
 *   - activity: recent event feed
 *
 * Query params:
 *   ?view=actions  — actions only
 *   ?view=stats    — stats only
 *   ?view=activity — activity feed only
 *   ?limit=15      — activity feed limit (default 15, max 50)
 *   (no view)      — full dashboard payload
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const activityLimit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") || "15", 10)),
    );

    if (view === "actions") {
      const actions = await getDashboardActions(guard);
      return NextResponse.json({ actions });
    }

    if (view === "stats") {
      const stats = await getDashboardStats(guard);
      return NextResponse.json({ stats });
    }

    if (view === "activity") {
      const activity = await getDashboardActivity(guard, activityLimit);
      return NextResponse.json({ activity });
    }

    const [actions, stats, activity] = await Promise.all([
      getDashboardActions(guard),
      getDashboardStats(guard),
      getDashboardActivity(guard, activityLimit),
    ]);

    return NextResponse.json({
      role: guard.role,
      organizationId: guard.organizationId,
      actions,
      stats,
      activity,
    });
  } catch (err) {
    console.error("[Dashboard] Error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 },
    );
  }
}
