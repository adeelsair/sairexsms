import { NextResponse } from "next/server";
import { isSuperAdmin, requireAuth } from "@/lib/auth-guard";
import { getOrganizationPlanUsage } from "@/lib/billing/plan-usage.service";

export async function GET(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;
  if (guard.impersonation) {
    return NextResponse.json(
      { ok: false, error: "Billing routes are unavailable during impersonation" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await getOrganizationPlanUsage(orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load plan usage";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

