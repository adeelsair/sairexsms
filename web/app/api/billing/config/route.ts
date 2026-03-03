import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-guard";
import { resolveAuditActor } from "@/lib/audit/resolve-audit-actor";
import {
  getOrganizationBillingConfig,
  updateOrganizationBillingConfig,
} from "@/lib/billing/billing-config.service";
import { billingConfigUpdateSchema } from "@/lib/validations";

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
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await getOrganizationBillingConfig(orgId);
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load billing config";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;
  if (guard.impersonation) {
    return NextResponse.json(
      { ok: false, error: "Billing routes are unavailable during impersonation" },
      { status: 403 },
    );
  }

  const denied = requireRole(guard, "SUPER_ADMIN");
  if (denied) return denied;

  try {
    const auditActor = resolveAuditActor(guard);
    const body = (await request.json()) as unknown;
    const parsed = billingConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid billing config payload",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const data = await updateOrganizationBillingConfig({
      organizationId: orgId,
      perStudentFee: parsed.data.perStudentFee,
      closingDay: parsed.data.closingDay,
      revenueCalculationMode: parsed.data.revenueCalculationMode,
      changedByUserId: guard.id,
      changedByEmail: guard.email,
      auditActor,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update billing config";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

