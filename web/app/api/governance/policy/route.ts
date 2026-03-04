import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { getControlPolicy, updateControlPolicy } from "@/lib/governance";

/**
 * GET  /api/governance/policy — Fetch org control policy
 * POST /api/governance/policy — Update org control policy (ORG_ADMIN only)
 */

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "ORG_ADMIN", "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const policy = await getControlPolicy(guard.organizationId!);
    return NextResponse.json(policy);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch control policy" },
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

    const validModes = ["CENTRALIZED", "CAMPUS_AUTONOMOUS"];
    const updates: Record<string, string> = {};

    for (const key of [
      "feeControlMode",
      "academicControlMode",
      "messagingControlMode",
      "postingControlMode",
    ]) {
      if (body[key] && validModes.includes(body[key])) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid control mode fields provided" },
        { status: 400 },
      );
    }

    const result = await updateControlPolicy(guard.organizationId!, updates);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to update control policy" },
      { status: 500 },
    );
  }
}
