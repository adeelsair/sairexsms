import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { getOrganizationFinanceDetail } from "@/lib/billing/finance-org-detail.service";

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const organizationId = guard.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await getOrganizationFinanceDetail(organizationId);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load organization finance detail";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
