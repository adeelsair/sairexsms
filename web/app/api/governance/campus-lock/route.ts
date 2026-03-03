import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import {
  getCampusLockStatus,
  lockCampus,
  unlockCampus,
} from "@/lib/governance";

/**
 * GET  /api/governance/campus-lock?campusId=123 — Get lock status
 * POST /api/governance/campus-lock              — Lock or unlock a campus (ORG_ADMIN)
 *
 * POST body:
 *   { campusId: number, action: "lock" | "unlock", financial?: boolean, academic?: boolean, reason?: string }
 */

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const campusIdStr = searchParams.get("campusId");

  if (!campusIdStr) {
    return NextResponse.json(
      { error: "campusId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const status = await getCampusLockStatus(Number(campusIdStr));
    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch campus lock status" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { campusId, action, financial, academic, reason } = body;

    if (!campusId || !action) {
      return NextResponse.json(
        { error: "campusId and action are required" },
        { status: 400 },
      );
    }

    if (action === "unlock") {
      const result = await unlockCampus(Number(campusId));
      return NextResponse.json(result);
    }

    if (action === "lock") {
      const result = await lockCampus({
        campusId: Number(campusId),
        financial: financial ?? false,
        academic: academic ?? false,
        reason,
        userId: guard.id,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "action must be 'lock' or 'unlock'" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update campus lock" },
      { status: 500 },
    );
  }
}
