import { NextResponse } from "next/server";
import { isSuperAdmin, requireAuth, requireRole } from "@/lib/auth-guard";
import {
  applyAdjustment,
  calculateLiveMetrics,
  closeCycle,
  createMonthlyCycles,
  listRevenueCycles,
  RevenueCycleError,
} from "@/lib/billing/revenue-cycle.service";

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

    const view = searchParams.get("view");
    if (view === "live") {
      const month = Number(searchParams.get("month"));
      const year = Number(searchParams.get("year"));
      if (!month || !year) {
        return NextResponse.json(
          { ok: false, error: "month and year are required for live view" },
          { status: 400 },
        );
      }

      const data = await calculateLiveMetrics(orgId, month, year);
      return NextResponse.json({ ok: true, data });
    }

    const data = await listRevenueCycles(
      orgId,
      searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    );
    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    if (error instanceof RevenueCycleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to load revenue cycles";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;
  if (guard.impersonation) {
    return NextResponse.json(
      { ok: false, error: "Billing routes are unavailable during impersonation" },
      { status: 403 },
    );
  }

  const roleCheck = requireRole(guard, "SUPER_ADMIN", "ORG_ADMIN");
  if (roleCheck) return roleCheck;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const orgId = guard.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization context required" },
        { status: 400 },
      );
    }

    const action = String(body.action ?? "");

    if (action === "createMonthlyCycles") {
      const month = Number(body.month);
      const year = Number(body.year);
      if (!month || !year) {
        return NextResponse.json(
          { ok: false, error: "month and year are required" },
          { status: 400 },
        );
      }

      const data = await createMonthlyCycles(month, year);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "closeCycle") {
      const cycleId = String(body.cycleId ?? "");
      if (!cycleId) {
        return NextResponse.json(
          { ok: false, error: "cycleId is required" },
          { status: 400 },
        );
      }

      const data = await closeCycle(cycleId, orgId);
      return NextResponse.json({ ok: true, data });
    }

    if (action === "applyAdjustment") {
      const cycleId = String(body.cycleId ?? "");
      const amount = Number(body.amount);
      const reason = String(body.reason ?? "");
      if (!cycleId || Number.isNaN(amount) || !reason.trim()) {
        return NextResponse.json(
          { ok: false, error: "cycleId, amount, and reason are required" },
          { status: 400 },
        );
      }

      const data = await applyAdjustment({
        cycleId,
        organizationId: orgId,
        amount,
        reason: reason.trim(),
        createdBy: guard.email,
      });
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error: unknown) {
    if (error instanceof RevenueCycleError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to process revenue cycle action";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

